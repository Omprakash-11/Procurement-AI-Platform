import { NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity'
import { apiError, requireUser, validationError, withErrors } from '@/lib/api'
import { vendorEntryActionSchema } from '@/lib/schemas/vendor-invite'
import { SHORTLISTABLE, VENDOR_STATUS_LABEL, type VendorStatus } from '@/lib/status'
import { notifyVendorOutcome } from '@/lib/vendor-notify'

type Params = { params: Promise<{ id: string; entryId: string }> }

// PATCH /api/rfps/[id]/vendors/[entryId] — vendor list actions (PM). Not in Backend Schema §8;
// added for App Flow §4 "Shortlist toggle" and "Remove" (decisions P5-5, P5-6).
//   remove      — only while Invited: expires pending invites, entry → Not Selected (kept).
//   shortlist   — once submitted: → Shortlisted (vendor emailed once — P5-6).
//   unshortlist — Shortlisted → Under Review (no email).
export const PATCH = withErrors(async function PATCH(request: Request, { params }: Params) {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response
  const { id: rfpId, entryId } = await params

  const parsed = vendorEntryActionSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return validationError(parsed.error)
  const { action } = parsed.data

  const { data: entry } = await auth.supabase
    .from('rfp_vendor_entries')
    .select('id, org_id, status, is_shortlisted, vendor_account_id, vendor_accounts(company_name, email), rfps(title, is_deleted)')
    .eq('id', entryId)
    .eq('rfp_id', rfpId)
    .maybeSingle()
  if (!entry || entry.rfps?.is_deleted) return apiError(404, 'not_found', 'Vendor not found on this RFP.')

  let next: { status: VendorStatus; is_shortlisted: boolean }
  if (action === 'remove') {
    if (entry.status !== 'invited') {
      return apiError(409, 'cannot_remove', 'Only vendors who haven’t submitted can be removed.')
    }
    next = { status: 'not_selected', is_shortlisted: false }
  } else if (action === 'shortlist') {
    if (!SHORTLISTABLE.includes(entry.status)) {
      return apiError(409, 'cannot_shortlist', 'Vendors can be shortlisted once they have submitted a proposal.')
    }
    next = { status: 'shortlisted', is_shortlisted: true }
  } else {
    if (entry.status !== 'shortlisted') return apiError(409, 'not_shortlisted', 'This vendor is not shortlisted.')
    next = { status: 'under_review', is_shortlisted: false }
  }

  const { error } = await auth.supabase.from('rfp_vendor_entries').update(next).eq('id', entryId)
  if (error) return apiError(500, 'update_failed', 'We could not update this vendor. Please try again.')

  if (action === 'remove') {
    await auth.supabase
      .from('vendor_invites')
      .update({ status: 'expired' })
      .eq('rfp_id', rfpId)
      .eq('vendor_account_id', entry.vendor_account_id)
      .eq('status', 'pending')
  }

  const company = entry.vendor_accounts?.company_name ?? 'Vendor'
  await logActivity({
    orgId: entry.org_id,
    actorId: auth.userId,
    actorType: 'profile',
    entityType: 'rfp_vendor_entry',
    entityId: entryId,
    action: action === 'remove' ? 'vendor.removed' : action === 'shortlist' ? 'vendor.shortlisted' : 'vendor.status_changed',
    description:
      action === 'remove'
        ? `${company} removed from "${entry.rfps?.title}"`
        : `${company}: ${VENDOR_STATUS_LABEL[entry.status]} → ${VENDOR_STATUS_LABEL[next.status]}`,
    before: { status: entry.status, is_shortlisted: entry.is_shortlisted },
    after: next,
    metadata: { rfp_id: rfpId, vendor_account_id: entry.vendor_account_id },
  })

  if (action === 'shortlist' && entry.vendor_accounts?.email) {
    await notifyVendorOutcome({
      orgId: entry.org_id,
      rfpId,
      rfpTitle: entry.rfps?.title ?? '',
      entryId,
      vendorEmail: entry.vendor_accounts.email,
      outcome: 'shortlisted',
      actorId: auth.userId,
    })
  }

  return NextResponse.json({ status: next.status })
})
