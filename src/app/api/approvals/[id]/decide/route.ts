import { NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity'
import { afterApproved, afterRejected } from '@/lib/approval-workflow'
import { apiError, requireUser, validationError } from '@/lib/api'
import { decisionSchema, REJECTION_REASON_LABEL } from '@/lib/schemas/approval'

type Params = { params: Promise<{ id: string }> }

// PATCH /api/approvals/[id]/decide — Backend Schema §8.6 (FA). App Flow §6: approve or reject,
// comment mandatory, reject needs a reason. RLS approvals_fa_decide (0027): only the FA the
// request was sent to, only while pending. Approval → contract + vendor Contracted (trigger
// §6.4); the rest of P8-6 follows in afterApproved / afterRejected.
export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireUser(['finance_approver'])
  if (!auth.ok) return auth.response
  const { id } = await params
  const parsed = decisionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return validationError(parsed.error)
  const d = parsed.data

  const { data: before } = await auth.supabase
    .from('approval_requests')
    .select('id, org_id, rfp_id, vendor_account_id, submitted_by, submitted_to, status, rfps(title), vendor_accounts(company_name)')
    .eq('id', id)
    .maybeSingle()
  if (!before) return apiError(404, 'not_found', 'Approval request not found.')
  if (before.submitted_to !== auth.userId) return apiError(403, 'not_assignee', 'This request was sent to another finance approver.')
  if (before.status !== 'pending') return apiError(409, 'already_decided', 'This request has already been decided or recalled.')

  const decidedAt = new Date().toISOString()
  const { data: updated, error } = await auth.supabase
    .from('approval_requests')
    .update({
      status: d.decision,
      decision_comment: d.comment,
      rejection_reason: d.decision === 'rejected' ? d.reason : null,
      decided_by: auth.userId,
      decided_at: decidedAt,
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id')
  if (error || !updated?.length) return apiError(409, 'already_decided', 'This request has already been decided or recalled.')

  const { data: me } = await auth.supabase.from('profiles').select('full_name').eq('id', auth.userId).single()
  const ctx = {
    approvalId: id,
    orgId: before.org_id,
    rfpId: before.rfp_id,
    rfpTitle: before.rfps?.title ?? 'RFP',
    vendorAccountId: before.vendor_account_id,
    vendorName: before.vendor_accounts?.company_name ?? 'Vendor',
    pmId: before.submitted_by,
    actorId: auth.userId,
    actorName: me?.full_name ?? 'The finance approver',
    comment: d.comment,
  }
  await logActivity({
    orgId: before.org_id, actorId: auth.userId, actorType: 'profile', entityType: 'approval_request', entityId: id,
    action: `approval.${d.decision}`,
    description: `${ctx.vendorName} ${d.decision} for "${ctx.rfpTitle}"${d.decision === 'rejected' ? ` — ${REJECTION_REASON_LABEL[d.reason]}` : ''}`,
    before: { status: 'pending' },
    after: { status: d.decision, decision_comment: d.comment, rejection_reason: d.decision === 'rejected' ? d.reason : null, decided_at: decidedAt },
    metadata: { rfp_id: before.rfp_id, vendor_account_id: before.vendor_account_id },
  })

  if (d.decision === 'approved') await afterApproved(ctx)
  else await afterRejected({ ...ctx, reason: d.reason })
  return NextResponse.json({ status: d.decision })
}
