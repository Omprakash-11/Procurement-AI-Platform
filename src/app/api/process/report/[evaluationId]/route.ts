import { NextResponse } from 'next/server'

import { apiError, requireUser, withErrors } from '@/lib/api'
import { AiError } from '@/lib/gemini/client'
import { EVALUATION_LOCKED, evaluationLockedMessage } from '@/lib/processing/locks'
import { generateReport } from '@/lib/processing/report'

export const maxDuration = 300

type Params = { params: Promise<{ evaluationId: string }> }

// POST /api/process/report/[evaluationId] — Backend Schema §8.4 / PRD §5.5.1: executive summary
// and advisory recommendation from the current scores and compliance flags. Synchronous (one
// AI call); failures come back inline with Retry.
export const POST = withErrors(async function POST(_request: Request, { params }: Params) {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response
  const { evaluationId } = await params

  const { data: evaluation } = await auth.supabase
    .from('evaluations')
    .select('id, rfp_id, status, rfps!inner(status, is_deleted)')
    .eq('id', evaluationId)
    .maybeSingle()
  if (!evaluation || evaluation.rfps.is_deleted) return apiError(404, 'not_found', 'Evaluation not found.')
  if (EVALUATION_LOCKED.includes(evaluation.rfps.status)) return apiError(409, 'locked', evaluationLockedMessage)
  if (!['scored', 'report_generated'].includes(evaluation.status)) {
    return apiError(409, 'not_scored', 'The report can be generated once scoring is complete.')
  }
  const { count } = await auth.supabase.from('vendor_scores').select('id', { count: 'exact', head: true }).eq('evaluation_id', evaluationId)
  if (!count) return apiError(409, 'no_scores', 'No vendor has been scored yet. Retry scoring first.')

  try {
    await generateReport(evaluation.rfp_id, auth.userId)
  } catch (err) {
    console.error('report generation failed', err)
    return apiError(502, 'ai_failed', err instanceof AiError ? err.message : 'The report could not be generated. Please retry.')
  }
  return NextResponse.json({ status: 'report_generated', rfpId: evaluation.rfp_id })
})
