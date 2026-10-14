import { createAdminClient } from '@/lib/supabase/server'
import { getVendorRfp, type VendorRfp } from '@/lib/vendor/portal'

/** The signed-in vendor's own submission (and its RFP view), or null — the ownership check. */
export async function loadOwnedSubmission(userId: string, submissionId: string): Promise<{ submissionId: string; rfp: VendorRfp } | null> {
  const { data: sub } = await createAdminClient()
    .from('submissions')
    .select('id, rfp_id, vendor_accounts!inner(auth_user_id)')
    .eq('id', submissionId)
    .eq('vendor_accounts.auth_user_id', userId)
    .maybeSingle()
  if (!sub) return null
  const rfp = await getVendorRfp(userId, sub.rfp_id)
  if (!rfp || rfp.submission?.id !== sub.id) return null
  return { submissionId: sub.id, rfp }
}
