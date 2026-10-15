import ApprovalDecisionEmail from '@/emails/approval-decision'
import { logActivity } from '@/lib/activity'
import { appUrl } from '@/lib/api'
import { sendEmail } from '@/lib/email/send'
import { notify } from '@/lib/processing/notify'
import { REJECTION_REASON_LABEL } from '@/lib/schemas/approval'
import { createAdminClient } from '@/lib/supabase/server'
import { notifyVendorOutcome } from '@/lib/vendor-notify'
import type { Enums } from '@/types'

// Decision P8-6: what follows an FA decision or a PM recall. Runs with the service role after
// the caller's own RLS-checked update succeeded (FA / PM can't write rfps / entries directly).

type Decided = {
  approvalId: string
  orgId: string
  rfpId: string
  rfpTitle: string
  vendorAccountId: string
  vendorName: string
  pmId: string
  actorId: string
  actorName: string
}

export async function afterApproved(d: Decided & { comment: string }): Promise<void> {
  const admin = createAdminClient()
  // The trigger (Schema §6.4) already created the contract and set the vendor to Contracted.
  await admin.from('rfps').update({ status: 'contracted' }).eq('id', d.rfpId).eq('status', 'approval_pending')
  const { data: reqs } = await admin.from('requirements').update({ status: 'vendor_selected' }).eq('linked_rfp_id', d.rfpId).in('status', ['in_progress', 'submitted']).select('id, title')
  const { data: contract } = await admin.from('contracts').select('id, title').eq('approval_request_id', d.approvalId).maybeSingle()

  await logActivity({
    orgId: d.orgId, actorId: d.actorId, actorType: 'profile', entityType: 'rfp', entityId: d.rfpId,
    action: 'rfp.status_changed', description: `"${d.rfpTitle}" moved to Contracted`,
    before: { status: 'approval_pending' }, after: { status: 'contracted' }, metadata: { rfp_id: d.rfpId },
  })
  if (contract) {
    await logActivity({
      orgId: d.orgId, actorId: d.actorId, actorType: 'profile', entityType: 'contract', entityId: contract.id,
      action: 'contract.created', description: `Contract "${contract.title}" created with ${d.vendorName}`,
      after: { status: 'active', vendor_account_id: d.vendorAccountId }, metadata: { rfp_id: d.rfpId, vendor_account_id: d.vendorAccountId, contract_id: contract.id },
    })
  }
  for (const r of reqs ?? []) {
    await logActivity({
      orgId: d.orgId, actorId: d.actorId, actorType: 'profile', entityType: 'requirement', entityId: r.id,
      action: 'requirement.status_changed', description: `Requirement "${r.title}" — vendor selected`,
      after: { status: 'vendor_selected' }, metadata: { rfp_id: d.rfpId },
    })
  }

  // Everyone else still in the running is Not Selected; P5-6 outcome emails (once each).
  const { data: entries } = await admin
    .from('rfp_vendor_entries')
    .select('id, vendor_account_id, status, vendor_accounts(email, company_name)')
    .eq('rfp_id', d.rfpId)
  for (const e of entries ?? []) {
    if (!e.vendor_accounts) continue
    if (e.vendor_account_id === d.vendorAccountId) {
      await notifyVendorOutcome({ orgId: d.orgId, rfpId: d.rfpId, rfpTitle: d.rfpTitle, entryId: e.id, vendorEmail: e.vendor_accounts.email, outcome: 'contracted', actorId: d.actorId })
      continue
    }
    if (!['submitted', 'under_review', 'shortlisted', 'approved'].includes(e.status)) continue
    await admin.from('rfp_vendor_entries').update({ status: 'not_selected' }).eq('id', e.id)
    await logActivity({
      orgId: d.orgId, actorId: d.actorId, actorType: 'profile', entityType: 'rfp_vendor_entry', entityId: e.id,
      action: 'vendor.status_changed', description: `${e.vendor_accounts.company_name} not selected for "${d.rfpTitle}"`,
      before: { status: e.status }, after: { status: 'not_selected' }, metadata: { rfp_id: d.rfpId, vendor_account_id: e.vendor_account_id },
    })
    await notifyVendorOutcome({ orgId: d.orgId, rfpId: d.rfpId, rfpTitle: d.rfpTitle, entryId: e.id, vendorEmail: e.vendor_accounts.email, outcome: 'not_selected', actorId: d.actorId })
  }

  await notifyPmOfDecision(d, 'approved', d.comment, null)
}

export async function afterRejected(d: Decided & { comment: string; reason: Enums<'rejection_reason'> }): Promise<void> {
  await backToShortlisted(d)
  await notifyPmOfDecision(d, 'rejected', d.comment, d.reason)
}

/** Reject / recall: the RFP returns to Shortlisted so the PM can resubmit (P8-6). */
export async function backToShortlisted(d: Pick<Decided, 'orgId' | 'rfpId' | 'rfpTitle' | 'actorId'>): Promise<void> {
  const { data: moved } = await createAdminClient().from('rfps').update({ status: 'shortlisted' }).eq('id', d.rfpId).eq('status', 'approval_pending').select('id')
  if (!moved?.length) return
  await logActivity({
    orgId: d.orgId, actorId: d.actorId, actorType: 'profile', entityType: 'rfp', entityId: d.rfpId,
    action: 'rfp.status_changed', description: `"${d.rfpTitle}" moved back to Shortlisted`,
    before: { status: 'approval_pending' }, after: { status: 'shortlisted' }, metadata: { rfp_id: d.rfpId },
  })
}

// App Flow §8.3: approval decision made → PM, in-app + email.
async function notifyPmOfDecision(d: Decided, decision: 'approved' | 'rejected', comment: string, reason: Enums<'rejection_reason'> | null) {
  await notify({
    orgId: d.orgId,
    recipientId: d.pmId,
    type: 'approval_decided',
    title: `${d.vendorName} ${decision} by ${d.actorName}`,
    body: reason ? `"${d.rfpTitle}" — ${REJECTION_REASON_LABEL[reason]}` : `"${d.rfpTitle}"`,
    entityType: 'rfp',
    entityId: d.rfpId,
  })
  const { data: pmUser } = await createAdminClient().auth.admin.getUserById(d.pmId)
  if (!pmUser.user?.email) return
  try {
    await sendEmail({
      to: pmUser.user.email,
      subject: decision === 'approved' ? 'Vendor selection approved' : 'Vendor selection rejected',
      react: ApprovalDecisionEmail({
        decision,
        rfpTitle: d.rfpTitle,
        vendorName: d.vendorName,
        decidedBy: d.actorName,
        comment,
        reason: reason ? REJECTION_REASON_LABEL[reason] : null,
        rfpUrl: appUrl(`/pipeline/rfp/${d.rfpId}`),
      }),
    })
  } catch (err) {
    console.error('approval decision email failed', err)
  }
}

const SLA_FORMAT = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** SLA deadlines are UTC (decision P8-2), so emails show them in UTC. */
export const formatSla = (iso: string) => `${SLA_FORMAT.format(new Date(iso))} UTC`
