import { NextResponse } from 'next/server'

import { apiError, INTERNAL_ROLES, requireUser } from '@/lib/api'
import { loadEvaluation } from '@/lib/evaluation'

type Params = { params: Promise<{ rfpId: string }> }

// GET /api/evaluations/[rfpId] — Backend Schema §8.5: evaluation with criteria and all vendor
// scores (current run). PM, DH, FA — RLS (can_read_rfp / can_read_evaluation) scopes DH and FA.
export async function GET(_request: Request, { params }: Params) {
  const auth = await requireUser(INTERNAL_ROLES)
  if (!auth.ok) return auth.response
  const { rfpId } = await params
  const evaluation = await loadEvaluation(auth.supabase, rfpId)
  if (!evaluation) return apiError(404, 'not_found', 'Evaluation not found.')
  return NextResponse.json({ evaluation })
}
