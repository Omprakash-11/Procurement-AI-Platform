import type { SupabaseClient } from '@supabase/supabase-js'

import { FLAG_TYPE_LABEL } from '@/lib/vendor-detail'
import type { Database, Enums } from '@/types'

// Approval read model (Backend Schema §2.14, App Flow §6). Callers pass the signed-in user's
// client: RLS approvals_read limits rows to PM and FA of the org.

type Client = SupabaseClient<Database>

export type ApprovalRow = {
  id: string
  status: Enums<'approval_status'>
  rfpId: string
  rfpTitle: string
  vendorAccountId: string
  vendorName: string
  submittedById: string
  submittedByName: string
  submittedToId: string
  submittedToName: string
  submittedAt: string
  slaDueAt: string
  decidedAt: string | null
}

export type ApprovalDetail = ApprovalRow & {
  evaluationId: string
  decisionComment: string | null
  rejectionReason: Enums<'rejection_reason'> | null
  decidedByName: string | null
  recalledAt: string | null
  /** Decision P8-5: escalated flags on the selected vendor's documents, derived live. */
  escalations: { id: string; flagType: string; severity: Enums<'flag_severity'>; clauseText: string | null; explanation: string; fileName: string }[]
}

const LIST_SELECT =
  'id, status, rfp_id, vendor_account_id, submitted_by, submitted_to, created_at, sla_due_at, decided_at, rfps(title), vendor_accounts(company_name), submitter:profiles!approval_requests_submitted_by_fkey(full_name), approver:profiles!approval_requests_submitted_to_fkey(full_name)'

type ListRaw = {
  id: string
  status: Enums<'approval_status'>
  rfp_id: string
  vendor_account_id: string
  submitted_by: string
  submitted_to: string
  created_at: string
  sla_due_at: string
  decided_at: string | null
  rfps: { title: string } | null
  vendor_accounts: { company_name: string } | null
  submitter: { full_name: string } | null
  approver: { full_name: string } | null
}

const toRow = (a: ListRaw): ApprovalRow => ({
  id: a.id,
  status: a.status,
  rfpId: a.rfp_id,
  rfpTitle: a.rfps?.title ?? 'RFP',
  vendorAccountId: a.vendor_account_id,
  vendorName: a.vendor_accounts?.company_name ?? 'Vendor',
  submittedById: a.submitted_by,
  submittedByName: a.submitter?.full_name ?? 'Procurement Manager',
  submittedToId: a.submitted_to,
  submittedToName: a.approver?.full_name ?? 'Finance Approver',
  submittedAt: a.created_at,
  slaDueAt: a.sla_due_at,
  decidedAt: a.decided_at,
})

export async function loadApprovals(client: Client, filter: { status?: Enums<'approval_status'>; rfpId?: string } = {}): Promise<ApprovalRow[]> {
  let q = client.from('approval_requests').select(LIST_SELECT).order('created_at', { ascending: false })
  if (filter.status) q = q.eq('status', filter.status)
  if (filter.rfpId) q = q.eq('rfp_id', filter.rfpId)
  const { data } = await q.returns<ListRaw[]>()
  return (data ?? []).map(toRow)
}

export async function loadApproval(client: Client, id: string): Promise<ApprovalDetail | null> {
  const { data } = await client
    .from('approval_requests')
    .select(`${LIST_SELECT}, evaluation_id, decision_comment, rejection_reason, recalled_at, decider:profiles!approval_requests_decided_by_fkey(full_name)`)
    .eq('id', id)
    .returns<(ListRaw & { evaluation_id: string; decision_comment: string | null; rejection_reason: Enums<'rejection_reason'> | null; recalled_at: string | null; decider: { full_name: string } | null })[]>()
    .maybeSingle()
  if (!data) return null

  const { data: flags } = await client
    .from('compliance_flags')
    .select('id, flag_type, severity, clause_text, explanation, documents!inner(file_name, submissions!inner(rfp_id, vendor_account_id))')
    .eq('status', 'escalated')
    .eq('documents.submissions.rfp_id', data.rfp_id)
    .eq('documents.submissions.vendor_account_id', data.vendor_account_id)

  return {
    ...toRow(data),
    evaluationId: data.evaluation_id,
    decisionComment: data.decision_comment,
    rejectionReason: data.rejection_reason,
    decidedByName: data.decider?.full_name ?? null,
    recalledAt: data.recalled_at,
    escalations: (flags ?? []).map((f) => ({
      id: f.id,
      flagType: FLAG_TYPE_LABEL[f.flag_type],
      severity: f.severity,
      clauseText: f.clause_text,
      explanation: f.explanation,
      fileName: f.documents.file_name,
    })),
  }
}
