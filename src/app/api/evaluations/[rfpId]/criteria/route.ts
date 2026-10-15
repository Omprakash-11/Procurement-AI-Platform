import { NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity'
import { apiError, requireUser, validationError } from '@/lib/api'
import { EVALUATION_LOCKED, evaluationLockedMessage } from '@/lib/processing/locks'
import { STALE_SCORING_MS } from '@/lib/processing/scoring'
import { criteriaSchema } from '@/lib/schemas/evaluation'

type Params = { params: Promise<{ rfpId: string }> }

// PUT /api/evaluations/[rfpId]/criteria — Backend Schema §8.5: save the confirmed criteria,
// replacing the existing ones (their scores go with them; a re-score follows). Weights must
// add up to exactly 100 (App Flow §4 criteria modal).
export async function PUT(request: Request, { params }: Params) {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response
  const { rfpId } = await params
  const parsed = criteriaSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return validationError(parsed.error)

  const { data: rfp } = await auth.supabase.from('rfps').select('id, org_id, title, status').eq('id', rfpId).eq('is_deleted', false).maybeSingle()
  if (!rfp) return apiError(404, 'not_found', 'RFP not found.')
  if (EVALUATION_LOCKED.includes(rfp.status)) return apiError(409, 'locked', evaluationLockedMessage)
  const { data: evaluation } = await auth.supabase.from('evaluations').select('id, status, updated_at').eq('rfp_id', rfpId).single()
  if (!evaluation) return apiError(404, 'not_found', 'Evaluation not found.')
  if (evaluation.status === 'scoring_in_progress' && Date.now() - new Date(evaluation.updated_at).getTime() < STALE_SCORING_MS) {
    return apiError(409, 'scoring_in_progress', 'Scoring is in progress. Wait for it to finish before changing the criteria.')
  }

  const { data: previous } = await auth.supabase.from('evaluation_criteria').select('name, weight').eq('evaluation_id', evaluation.id).order('sort_order')
  // RLS: criteria_pm_write. Delete first so the ≤ 100 weight trigger only sees the new set.
  const { error: delError } = await auth.supabase.from('evaluation_criteria').delete().eq('evaluation_id', evaluation.id)
  if (delError) return apiError(500, 'save_failed', 'We could not save the criteria. Please try again.')
  const { error } = await auth.supabase.from('evaluation_criteria').insert(
    parsed.data.criteria.map((c, i) => ({
      org_id: rfp.org_id,
      evaluation_id: evaluation.id,
      name: c.name,
      description: c.description ?? null,
      weight: c.weight,
      sort_order: i,
      is_ai_suggested: c.isAiSuggested,
    }))
  )
  if (error) return apiError(500, 'save_failed', 'We could not save the criteria. Please try again.')

  await auth.supabase
    .from('evaluations')
    .update({
      criteria_confirmed_at: new Date().toISOString(),
      criteria_confirmed_by: auth.userId,
      ...(evaluation.status === 'not_started' ? { status: 'criteria_pending' as const } : {}),
    })
    .eq('id', evaluation.id)
  if (parsed.data.templateId) {
    await auth.supabase.from('scoring_templates').update({ last_used_at: new Date().toISOString() }).eq('id', parsed.data.templateId)
  }

  await logActivity({
    orgId: rfp.org_id,
    actorId: auth.userId,
    actorType: 'profile',
    entityType: 'evaluation',
    entityId: evaluation.id,
    action: 'evaluation.criteria_confirmed',
    description: `Scoring criteria confirmed for "${rfp.title}" (${parsed.data.criteria.length} criteria)`,
    before: { criteria: (previous ?? []).map((c) => ({ name: c.name, weight: Number(c.weight) })) },
    after: { criteria: parsed.data.criteria.map((c) => ({ name: c.name, weight: c.weight, ai_suggested: c.isAiSuggested })) },
    metadata: { rfp_id: rfpId, template_id: parsed.data.templateId ?? null },
  })
  return NextResponse.json({ evaluationId: evaluation.id })
}
