import VendorStatusUpdateEmail, { type VendorOutcome } from '@/emails/vendor-status-update'
import { logActivity } from '@/lib/activity'
import { appUrl } from '@/lib/api'
import { sendEmail } from '@/lib/email/send'
import { createAdminClient } from '@/lib/supabase/server'

const NOTIFIED_ACTION = 'vendor.status_emailed'

// Decision P5-6 / App Flow §8.3 "Vendor status updated → vendor email": only on outcomes
// (Shortlisted, Not Selected, Contracted), at most once per status per vendor per RFP.
export async function notifyVendorOutcome(input: {
  orgId: string
  rfpId: string
  rfpTitle: string
  entryId: string
  vendorEmail: string
  outcome: VendorOutcome
  actorId: string
}): Promise<void> {
  const admin = createAdminClient()
  const { count } = await admin
    .from('activity_log')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', input.orgId)
    .eq('action', NOTIFIED_ACTION)
    .eq('entity_id', input.entryId)
    .contains('metadata', { outcome: input.outcome })
  if ((count ?? 0) > 0) return

  try {
    await sendEmail({
      to: input.vendorEmail,
      subject: 'Update on your ProcureMaster proposal',
      react: VendorStatusUpdateEmail({ outcome: input.outcome, rfpTitle: input.rfpTitle, portalUrl: appUrl('/vendor') }),
    })
  } catch (err) {
    console.error('notifyVendorOutcome: email failed', err)
    return
  }
  await logActivity({
    orgId: input.orgId,
    actorId: input.actorId,
    actorType: 'system',
    entityType: 'rfp_vendor_entry',
    entityId: input.entryId,
    action: NOTIFIED_ACTION,
    description: `Vendor emailed: ${input.outcome.replace('_', ' ')}`,
    metadata: { rfp_id: input.rfpId, outcome: input.outcome },
  })
}
