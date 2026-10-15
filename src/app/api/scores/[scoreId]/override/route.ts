import { NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity'
import { apiError, requireUser, validationError, withErrors } from '@/lib/api'
import { EVALUATION_LOCKED, evaluationLockedMessage } from '@/lib/processing/locks'
import { overrideSchema } from '@/lib/schemas/evaluation'

type Params = { params: Promise<{ scoreId: string }> }

// PATCH /api/scores/[scoreId]/override — Backend Schema §8.5 / PRD §5.3.3: the PM's override is
// stored next to the AI score (both kept); effective_score is generated from them.
export const PATCH = withErrors(async function PATCH(request: Request, { params }: Params) {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response
  const { scoreId } = await params
  const parsed = overrideSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return validationError(parsed.error)

  const { data: score } = await auth.supabase
    .from('vendor_scores')
    .select('id, org_id, vendor_account_id, ai_score, override_score, override_justification, scoring_run, evaluation_criteria(name), evaluations!inner(id, rfp_id, scoring_run_count, status, rfps!inner(title, status))')
    .eq('id', scoreId)
    .maybeSingle()
  if (!score) return apiError(404, 'not_found', 'Score not found.')
  if (EVALUATION_LOCKED.includes(score.evaluations.rfps.status)) return apiError(409, 'locked', evaluationLockedMessage)
  if (score.scoring_run !== score.evaluations.scoring_run_count || score.evaluations.status === 'scoring_in_progress') {
    return apiError(409, 'stale_score', 'These scores are being replaced by a newer scoring run. Refresh the page.')
  }

  const score2dp = Math.round(parsed.data.score * 100) / 100
  const { error } = await auth.supabase
    .from('vendor_scores')
    .update({ override_score: score2dp, override_justification: parsed.data.justification, overridden_by: auth.userId, overridden_at: new Date().toISOString() })
    .eq('id', scoreId)
  if (error) return apiError(500, 'save_failed', 'We could not save the override. Please try again.')

  await logActivity({
    orgId: score.org_id,
    actorId: auth.userId,
    actorType: 'profile',
    entityType: 'vendor_score',
    entityId: scoreId,
    action: 'score.overridden',
    description: `Score for "${score.evaluation_criteria?.name ?? 'criterion'}" overridden to ${score2dp} on "${score.evaluations.rfps.title}"`,
    before: { ai_score: score.ai_score, override_score: score.override_score, override_justification: score.override_justification },
    after: { ai_score: score.ai_score, override_score: score2dp, override_justification: parsed.data.justification },
    metadata: { rfp_id: score.evaluations.rfp_id, vendor_account_id: score.vendor_account_id },
  })
  return NextResponse.json({ overrideScore: score2dp })
})
