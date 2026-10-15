import { NextResponse } from 'next/server'

import ApprovalRequestEmail from '@/emails/approval-request'
import { logActivity } from '@/lib/activity'
import { loadApprovals } from '@/lib/approval-data'
import { formatSla } from '@/lib/approval-workflow'
import { addBusinessDaysUtc, SLA_BUSINESS_DAYS } from '@/lib/approvals'
import { apiError, appUrl, requireUser, validationError, withErrors } from '@/lib/api'
import { sendEmail } from '@/lib/email/send'
import { notify } from '@/lib/processing/notify'
import { approvalRequestSchema } from '@/lib/schemas/approval'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/approvals — Backend Schema §8.6: PM sees all; FA sees pending (?status=all for the
// queue's "All" tab). RLS approvals_read scopes to the org and to PM / FA.
export const GET = withErrors(async function GET(request: Request) {
  const auth = await requireUser(['procurement_manager', 'finance_approver'])
  if (!auth.ok) return auth.response
  const all = new URL(request.url).searchParams.get('status') === 'all'
  const isFa = auth.claims.role === 'finance_approver'
  return NextResponse.json({ approvals: await loadApprovals(auth.supabase, isFa && !all ? { status: 'pending' } : {}) })
})

// POST /api/approvals — Backend Schema §8.6 / App Flow §4 "Submit for Approval". Decision P8-1:
// the PM picks a shortlisted vendor and a Finance Approver; P8-2 SLA = 3 business days (UTC);
// P8-6 the RFP moves to Approval Pending. One pending request per RFP (unique index).
export const POST = withErrors(async function POST(request: Request) {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response
  const parsed = approvalRequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return validationError(parsed.error)
  const { rfpId, vendorAccountId, financeApproverId } = parsed.data

  const { data: rfp } = await auth.supabase
    .from('rfps')
    .select('id, org_id, title, status, evaluations(id, report_generated_at)')
    .eq('id', rfpId)
    .eq('is_deleted', false)
    .maybeSingle()
  if (!rfp) return apiError(404, 'not_found', 'RFP not found.')
  if (['approval_pending', 'contracted', 'archived'].includes(rfp.status)) {
    return apiError(409, 'not_submittable', rfp.status === 'approval_pending' ? 'This RFP already has a pending approval.' : 'This RFP can no longer be submitted for approval.')
  }
  if (!rfp.evaluations?.report_generated_at) return apiError(409, 'no_report', 'Generate the comparison report before submitting for approval.')

  const [{ data: entry }, { data: approver }] = await Promise.all([
    auth.supabase.from('rfp_vendor_entries').select('status, vendor_accounts(company_name)').eq('rfp_id', rfpId).eq('vendor_account_id', vendorAccountId).maybeSingle(),
    auth.supabase.from('profiles').select('id, full_name, role, is_active').eq('id', financeApproverId).maybeSingle(),
  ])
  if (!entry || entry.status !== 'shortlisted') {
    return apiError(400, 'validation_error', 'Some fields are invalid.', { fields: { vendorAccountId: ['Choose a shortlisted vendor.'] } })
  }
  if (!approver || approver.role !== 'finance_approver' || !approver.is_active) {
    return apiError(400, 'validation_error', 'Some fields are invalid.', { fields: { financeApproverId: ['Choose an active finance approver.'] } })
  }

  const slaDueAt = addBusinessDaysUtc(new Date(), SLA_BUSINESS_DAYS).toISOString()
  // RLS approvals_pm_insert: status pending, submitted_by = self.
  const { data: approval, error } = await auth.supabase
    .from('approval_requests')
    .insert({
      org_id: rfp.org_id,
      rfp_id: rfpId,
      vendor_account_id: vendorAccountId,
      evaluation_id: rfp.evaluations.id,
      submitted_by: auth.userId,
      submitted_to: financeApproverId,
      sla_due_at: slaDueAt,
    })
    .select('id')
    .single()
  if (error?.code === '23505') return apiError(409, 'already_pending', 'This RFP already has a pending approval.')
  if (error || !approval) return apiError(500, 'submit_failed', 'We could not submit for approval. Please try again.')

  const admin = createAdminClient()
  await admin.from('rfps').update({ status: 'approval_pending' }).eq('id', rfpId)
  const vendorName = entry.vendor_accounts?.company_name ?? 'Vendor'
  const { data: pm } = await auth.supabase.from('profiles').select('full_name').eq('id', auth.userId).single()

  await logActivity({
    orgId: rfp.org_id, actorId: auth.userId, actorType: 'profile', entityType: 'approval_request', entityId: approval.id,
    action: 'approval.submitted', description: `${vendorName} submitted for approval on "${rfp.title}" (to ${approver.full_name})`,
    after: { status: 'pending', vendor_account_id: vendorAccountId, submitted_to: financeApproverId, sla_due_at: slaDueAt },
    metadata: { rfp_id: rfpId, vendor_account_id: vendorAccountId },
  })
  await logActivity({
    orgId: rfp.org_id, actorId: auth.userId, actorType: 'profile', entityType: 'rfp', entityId: rfpId,
    action: 'rfp.status_changed', description: `"${rfp.title}" moved to Approval Pending`,
    before: { status: rfp.status }, after: { status: 'approval_pending' }, metadata: { rfp_id: rfpId },
  })

  // App Flow §8.3: approval request submitted → FA, in-app + email (deep link, App Flow §6).
  await notify({
    orgId: rfp.org_id, recipientId: financeApproverId, type: 'approval_requested',
    title: 'Approval requested', body: `${vendorName} for "${rfp.title}"`, entityType: 'approval_request', entityId: approval.id,
  })
  const { data: faUser } = await admin.auth.admin.getUserById(financeApproverId)
  if (faUser.user?.email) {
    try {
      await sendEmail({
        to: faUser.user.email,
        subject: 'A vendor selection needs your approval',
        react: ApprovalRequestEmail({ rfpTitle: rfp.title, vendorName, submittedBy: pm?.full_name ?? 'The procurement manager', slaDue: formatSla(slaDueAt), approvalUrl: appUrl(`/approvals/${approval.id}`) }),
      })
    } catch (err) {
      console.error('approval request email failed', err)
    }
  }
  return NextResponse.json({ id: approval.id, slaDueAt }, { status: 201 })
})
