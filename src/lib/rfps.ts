import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database, Enums } from '@/types'

export type RfpVendorRow = {
  entryId: string
  vendorAccountId: string
  companyName: string
  contactName: string
  email: string
  status: Enums<'vendor_pipeline_status'>
  isShortlisted: boolean
  /** Decision P5-5: removed while still invited — shown as "Removed". */
  removed: boolean
  documentCount: number
  flagCount: number
  /** Weighted total once scoring exists (Phase 7). */
  score: number | null
}

export type RfpDetail = {
  rfp: {
    id: string
    title: string
    description: string
    department: string
    budgetMin: number | null
    budgetMax: number | null
    submissionDeadline: string | null
    status: Enums<'rfp_status'>
    requirementId: string | null
    createdAt: string
  }
  currency: string
  vendors: RfpVendorRow[]
  submittedCount: number
  evaluationStatus: Enums<'evaluation_status'> | null
}

// Reads with the caller's client, so RLS (can_read_rfp) decides what is visible.
export async function loadRfpDetail(supabase: SupabaseClient<Database>, id: string): Promise<RfpDetail | null> {
  const { data: rfp } = await supabase
    .from('rfps')
    .select('id, org_id, title, description, department, budget_min, budget_max, submission_deadline, status, requirement_id, created_at, organisations(currency), evaluations(status)')
    .eq('id', id)
    .eq('is_deleted', false)
    .maybeSingle()
  if (!rfp) return null

  const [{ data: entries }, { data: submissions }] = await Promise.all([
    supabase
      .from('rfp_vendor_entries')
      .select('id, status, is_shortlisted, vendor_account_id, vendor_accounts(company_name, contact_name, email)')
      .eq('rfp_id', id)
      .order('created_at', { ascending: true }),
    supabase.from('submissions').select('vendor_account_id, status, documents(id, compliance_flags(count))').eq('rfp_id', id),
  ])

  const byVendor = new Map<string, { docs: number; flags: number; submitted: boolean }>()
  for (const s of submissions ?? []) {
    const docs = s.documents ?? []
    byVendor.set(s.vendor_account_id, {
      docs: docs.length,
      flags: docs.reduce((sum, d) => sum + (d.compliance_flags[0]?.count ?? 0), 0),
      submitted: s.status !== 'in_progress',
    })
  }

  const vendors: RfpVendorRow[] = (entries ?? []).map((e) => ({
    entryId: e.id,
    vendorAccountId: e.vendor_account_id,
    companyName: e.vendor_accounts?.company_name ?? '',
    contactName: e.vendor_accounts?.contact_name ?? '',
    email: e.vendor_accounts?.email ?? '',
    status: e.status,
    isShortlisted: e.is_shortlisted,
    // P5-5: "Not Selected" without ever submitting = removed while still invited.
    removed: e.status === 'not_selected' && !byVendor.get(e.vendor_account_id)?.submitted,
    documentCount: byVendor.get(e.vendor_account_id)?.docs ?? 0,
    flagCount: byVendor.get(e.vendor_account_id)?.flags ?? 0,
    score: null,
  }))

  return {
    rfp: {
      id: rfp.id,
      title: rfp.title,
      description: rfp.description,
      department: rfp.department,
      budgetMin: rfp.budget_min,
      budgetMax: rfp.budget_max,
      submissionDeadline: rfp.submission_deadline,
      status: rfp.status,
      requirementId: rfp.requirement_id,
      createdAt: rfp.created_at,
    },
    currency: rfp.organisations?.currency ?? 'USD',
    vendors,
    submittedCount: [...byVendor.values()].filter((s) => s.submitted).length,
    evaluationStatus: rfp.evaluations?.status ?? null,
  }
}

export function formatMoney(value: number | null, currency: string): string {
  if (value === null) return '—'
  return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
}

export function formatBudget(min: number | null, max: number | null, currency: string): string {
  if (min === null && max === null) return '—'
  if (min !== null && max !== null) return `${formatMoney(min, currency)} – ${formatMoney(max, currency)}`
  return min !== null ? `From ${formatMoney(min, currency)}` : `Up to ${formatMoney(max, currency)}`
}

/** Escape LIKE/ILIKE wildcards so a value matches literally (emails often contain "_"). */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`)
}
