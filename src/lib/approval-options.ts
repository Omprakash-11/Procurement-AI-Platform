import type { SupabaseClient } from '@supabase/supabase-js'

import type { ApprovalOption, PendingApproval } from '@/components/approvals/submit-for-approval'
import { loadApprovals } from '@/lib/approval-data'
import type { Database } from '@/types'

/** Data for "Submit for Approval" (P8-1): shortlisted vendors, active FAs, any pending request. */
export async function loadApprovalOptions(client: SupabaseClient<Database>, rfpId: string): Promise<{ shortlisted: ApprovalOption[]; approvers: ApprovalOption[]; pending: PendingApproval | null }> {
  const [{ data: entries }, { data: fas }, pendingRows] = await Promise.all([
    client.from('rfp_vendor_entries').select('vendor_account_id, vendor_accounts(company_name)').eq('rfp_id', rfpId).eq('status', 'shortlisted'),
    client.from('profiles').select('id, full_name').eq('role', 'finance_approver').eq('is_active', true).order('full_name'),
    loadApprovals(client, { rfpId, status: 'pending' }),
  ])
  const p = pendingRows[0]
  return {
    shortlisted: (entries ?? []).map((e) => ({ id: e.vendor_account_id, name: e.vendor_accounts?.company_name ?? 'Vendor' })),
    approvers: (fas ?? []).map((f) => ({ id: f.id, name: f.full_name })),
    pending: p ? { id: p.id, approverName: p.submittedToName, slaDueAt: p.slaDueAt } : null,
  }
}
