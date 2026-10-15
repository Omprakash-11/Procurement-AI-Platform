import { NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity'
import { backToShortlisted } from '@/lib/approval-workflow'
import { apiError, requireUser } from '@/lib/api'

type Params = { params: Promise<{ id: string }> }

// PATCH /api/approvals/[id]/recall — Backend Schema §8.6 (PM recalls a pending request).
// RLS approvals_pm_recall (0027): pending → recalled with recalled_by = self. P8-6: the RFP
// goes back to Shortlisted.
export async function PATCH(_request: Request, { params }: Params) {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response
  const { id } = await params

  const { data: before } = await auth.supabase
    .from('approval_requests')
    .select('id, org_id, rfp_id, vendor_account_id, status, rfps(title), vendor_accounts(company_name)')
    .eq('id', id)
    .maybeSingle()
  if (!before) return apiError(404, 'not_found', 'Approval request not found.')
  if (before.status !== 'pending') return apiError(409, 'not_pending', 'Only a pending request can be recalled.')

  const { data: updated, error } = await auth.supabase
    .from('approval_requests')
    .update({ status: 'recalled', recalled_by: auth.userId, recalled_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id')
  if (error || !updated?.length) return apiError(409, 'not_pending', 'Only a pending request can be recalled.')

  const rfpTitle = before.rfps?.title ?? 'RFP'
  await logActivity({
    orgId: before.org_id, actorId: auth.userId, actorType: 'profile', entityType: 'approval_request', entityId: id,
    action: 'approval.recalled', description: `Approval request for ${before.vendor_accounts?.company_name ?? 'vendor'} on "${rfpTitle}" recalled`,
    before: { status: 'pending' }, after: { status: 'recalled' },
    metadata: { rfp_id: before.rfp_id, vendor_account_id: before.vendor_account_id },
  })
  await backToShortlisted({ orgId: before.org_id, rfpId: before.rfp_id, rfpTitle, actorId: auth.userId })
  return NextResponse.json({ status: 'recalled' })
}
