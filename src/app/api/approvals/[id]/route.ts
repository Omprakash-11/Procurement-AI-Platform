import { NextResponse } from 'next/server'

import { loadApproval } from '@/lib/approval-data'
import { apiError, requireUser } from '@/lib/api'
import { loadReport } from '@/lib/evaluation'
import { loadReportComments } from '@/lib/report-comments'

type Params = { params: Promise<{ id: string }> }

// GET /api/approvals/[id] — Backend Schema §8.6: approval with full report data (PM, FA).
// RLS: approvals_read; the report is readable by an FA once an approval exists (can_read_rfp).
export async function GET(_request: Request, { params }: Params) {
  const auth = await requireUser(['procurement_manager', 'finance_approver'])
  if (!auth.ok) return auth.response
  const { id } = await params
  const approval = await loadApproval(auth.supabase, id)
  if (!approval) return apiError(404, 'not_found', 'Approval request not found.')
  const [report, comments] = await Promise.all([loadReport(auth.supabase, approval.rfpId), loadReportComments(auth.supabase, approval.rfpId)])
  return NextResponse.json({ approval, report, comments })
}
