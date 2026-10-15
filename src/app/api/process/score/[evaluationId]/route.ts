import { waitUntil } from '@vercel/functions'
import { NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity'
import { apiError, requireUser, validationError } from '@/lib/api'
import { EVALUATED_STATUSES } from '@/lib/evaluation'
import { EVALUATION_LOCKED, evaluationLockedMessage } from '@/lib/processing/locks'
import { scoreEvaluation, STALE_SCORING_MS } from '@/lib/processing/scoring'
import { scoreRequestSchema } from '@/lib/schemas/evaluation'
import { createAdminClient } from '@/lib/supabase/server'

export const maxDuration = 300 // decision P7-2: scoring runs after the response

type Params = { params: Promise<{ evaluationId: string }> }

// POST /api/process/score/[evaluationId] — Backend Schema §8.4: score every vendor against the
// confirmed criteria; each full run increments scoring_run_count (a re-score keeps the old
// run's rows). Body { vendorAccountId } retries one vendor within the current run.
// Decision P7 defaults: starting evaluation moves submitted vendors to Under Review and the
// RFP to Under Evaluation. Scoring is async; the PM is notified when it completes.
export async function POST(request: Request, { params }: Params) {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response
  const { evaluationId } = await params
  const parsed = scoreRequestSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return validationError(parsed.error)
  const { vendorAccountId } = parsed.data

  const { data: evaluation } = await auth.supabase
    .from('evaluations')
    .select('id, org_id, rfp_id, status, scoring_run_count, updated_at, rfps!inner(title, status, is_deleted)')
    .eq('id', evaluationId)
    .maybeSingle()
  if (!evaluation || evaluation.rfps.is_deleted) return apiError(404, 'not_found', 'Evaluation not found.')
  if (EVALUATION_LOCKED.includes(evaluation.rfps.status)) return apiError(409, 'locked', evaluationLockedMessage)
  const busy = evaluation.status === 'scoring_in_progress' && Date.now() - new Date(evaluation.updated_at).getTime() < STALE_SCORING_MS
  if (busy) return apiError(409, 'scoring_in_progress', 'Scoring is already in progress.')

  const { count: criteriaCount } = await auth.supabase.from('evaluation_criteria').select('id', { count: 'exact', head: true }).eq('evaluation_id', evaluationId)
  if (!criteriaCount) return apiError(409, 'no_criteria', 'Confirm the scoring criteria first.')

  const admin = createAdminClient()
  const { data: eligible } = await admin
    .from('rfp_vendor_entries')
    .select('id, vendor_account_id, status')
    .eq('rfp_id', evaluation.rfp_id)
    .in('status', EVALUATED_STATUSES)
  if (!eligible?.length) return apiError(409, 'no_vendors', 'No submitted vendors to score.')

  let run = evaluation.scoring_run_count
  if (vendorAccountId) {
    if (!['scored', 'report_generated'].includes(evaluation.status) && !(evaluation.status === 'scoring_in_progress' && !busy)) {
      return apiError(409, 'not_scored', 'Run scoring for all vendors first.')
    }
    if (!eligible.some((e) => e.vendor_account_id === vendorAccountId)) return apiError(404, 'not_found', 'Vendor not found in this evaluation.')
    const { data: started } = await admin
      .from('evaluations')
      .update({ status: 'scoring_in_progress' })
      .eq('id', evaluationId)
      .eq('status', evaluation.status)
      .eq('scoring_run_count', run)
      .select('id')
    if (!started?.length) return apiError(409, 'scoring_in_progress', 'Scoring is already in progress.')
  } else {
    run += 1
    // Optimistic on the old run count: two clicks can't start two runs. The previous report
    // described the previous scores, so it is cleared.
    const { data: started } = await admin
      .from('evaluations')
      .update({ status: 'scoring_in_progress', scoring_run_count: run, report_executive_summary: null, report_recommendation: null, report_generated_at: null })
      .eq('id', evaluationId)
      .eq('scoring_run_count', evaluation.scoring_run_count)
      .select('id')
    if (!started?.length) return apiError(409, 'scoring_in_progress', 'Scoring is already in progress.')

    const toReview = eligible.filter((e) => e.status === 'submitted').map((e) => e.id)
    if (toReview.length) {
      await admin.from('rfp_vendor_entries').update({ status: 'under_review' }).in('id', toReview).eq('status', 'submitted')
      await admin.from('submissions').update({ status: 'under_review' }).eq('rfp_id', evaluation.rfp_id).eq('status', 'submitted')
    }
    const { data: advanced } = await admin
      .from('rfps')
      .update({ status: 'under_evaluation' })
      .eq('id', evaluation.rfp_id)
      .in('status', ['rfp_created', 'vendors_invited', 'submissions_in'])
      .select('id')
    if (advanced?.length) {
      await logActivity({
        orgId: evaluation.org_id,
        actorId: auth.userId,
        actorType: 'profile',
        entityType: 'rfp',
        entityId: evaluation.rfp_id,
        action: 'rfp.status_changed',
        description: `"${evaluation.rfps.title}" moved to Under Evaluation`,
        before: { status: evaluation.rfps.status },
        after: { status: 'under_evaluation' },
        metadata: { rfp_id: evaluation.rfp_id },
      })
    }
  }

  await logActivity({
    orgId: evaluation.org_id,
    actorId: auth.userId,
    actorType: 'profile',
    entityType: 'evaluation',
    entityId: evaluationId,
    action: vendorAccountId ? 'evaluation.vendor_rescore' : 'evaluation.scoring_started',
    description: vendorAccountId ? `Scoring retried for one vendor on "${evaluation.rfps.title}"` : `AI scoring started for "${evaluation.rfps.title}" (run ${run})`,
    before: { status: evaluation.status, scoring_run_count: evaluation.scoring_run_count },
    after: { status: 'scoring_in_progress', scoring_run_count: run },
    metadata: { rfp_id: evaluation.rfp_id, ...(vendorAccountId ? { vendor_account_id: vendorAccountId } : {}) },
  })

  waitUntil(scoreEvaluation({ evaluationId, run, ...(vendorAccountId ? { vendorAccountIds: [vendorAccountId] } : {}) }))
  return NextResponse.json({ status: 'scoring_in_progress', run }, { status: 202 })
}
