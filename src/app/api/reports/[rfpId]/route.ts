import { NextResponse } from 'next/server'

import { apiError, INTERNAL_ROLES, requireUser } from '@/lib/api'
import { loadReport } from '@/lib/evaluation'

type Params = { params: Promise<{ rfpId: string }> }

// GET /api/reports/[rfpId] — Backend Schema §8.5: full comparison report data. PM, DH, FA —
// RLS (can_read_rfp) scopes DH to their requirements' RFPs and FA to RFPs sent for approval.
export async function GET(_request: Request, { params }: Params) {
  const auth = await requireUser(INTERNAL_ROLES)
  if (!auth.ok) return auth.response
  const { rfpId } = await params
  const report = await loadReport(auth.supabase, rfpId)
  if (!report || !report.evaluation.reportGeneratedAt) return apiError(404, 'not_found', 'Report not found.')
  return NextResponse.json({ report })
}
