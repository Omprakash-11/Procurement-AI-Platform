import type { SupabaseClient } from '@supabase/supabase-js'
import { differenceInCalendarDays, startOfDay } from 'date-fns'

import type { StatusTone } from '@/components/ui/status-badge'
import type { Database, Enums } from '@/types'

// Contracts read model (Backend Schema §2.15, App Flow §4 Contracts). RLS: contracts_pm (and
// contracts_fa_read for the API, P9 defaults).

type Client = SupabaseClient<Database>
export type ContractStatus = Enums<'contract_status'>

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  active: 'Active',
  expiring_soon: 'Expiring Soon',
  expired: 'Expired',
  terminated: 'Terminated',
}
export const CONTRACT_STATUS_TONE: Record<ContractStatus, StatusTone> = {
  active: 'success',
  expiring_soon: 'warning',
  expired: 'danger',
  terminated: 'neutral',
}

/** Calendar days from today to the end date (negative once past). */
export const daysUntil = (endDate: string) => differenceInCalendarDays(new Date(`${endDate}T12:00:00`), startOfDay(new Date()))

/** P9 defaults: same colours as the SLA — red past / due, amber inside the alert window, green. */
export function daysTone(days: number, alertDays: number, status: ContractStatus): StatusTone {
  if (status === 'terminated') return 'neutral'
  if (days <= 0) return 'danger'
  return days <= alertDays ? 'warning' : 'success'
}

export type ContractRow = {
  id: string
  title: string
  vendorAccountId: string
  vendorName: string
  rfpId: string
  rfpTitle: string
  value: number | null
  currency: string
  startDate: string
  endDate: string
  daysRemaining: number
  alertDays: number
  status: ContractStatus
}

export type ContractDetail = ContractRow & {
  department: string
  paymentTerms: string | null
  documentName: string | null
  hasDocument: boolean
  terminatedAt: string | null
  terminationReason: string | null
  vendorEmail: string
}

const SELECT =
  'id, title, vendor_account_id, rfp_id, value, currency, start_date, end_date, alert_days, status, payment_terms, document_path, terminated_at, termination_reason, vendor_accounts(company_name, email), rfps(title, department)'

type Raw = {
  id: string
  title: string
  vendor_account_id: string
  rfp_id: string
  value: number | null
  currency: string
  start_date: string
  end_date: string
  alert_days: number
  status: ContractStatus
  payment_terms: string | null
  document_path: string | null
  terminated_at: string | null
  termination_reason: string | null
  vendor_accounts: { company_name: string; email: string } | null
  rfps: { title: string; department: string } | null
}

const toRow = (c: Raw): ContractRow => ({
  id: c.id,
  title: c.title,
  vendorAccountId: c.vendor_account_id,
  vendorName: c.vendor_accounts?.company_name ?? 'Vendor',
  rfpId: c.rfp_id,
  rfpTitle: c.rfps?.title ?? 'RFP',
  value: c.value === null ? null : Number(c.value),
  currency: c.currency,
  startDate: c.start_date,
  endDate: c.end_date,
  daysRemaining: daysUntil(c.end_date),
  alertDays: c.alert_days,
  status: c.status,
})

export type ContractSort = 'end_date' | 'value' | 'vendor'

/** App Flow §4: filter by status; sort by end date (default, ascending), value or vendor. */
export async function loadContracts(client: Client, opts: { status?: ContractStatus; sort?: ContractSort } = {}): Promise<ContractRow[]> {
  let q = client.from('contracts').select(SELECT).eq('is_deleted', false)
  if (opts.status) q = q.eq('status', opts.status)
  const { data } = await q.order('end_date', { ascending: true }).returns<Raw[]>()
  const rows = (data ?? []).map(toRow)
  if (opts.sort === 'value') rows.sort((a, b) => (b.value ?? -1) - (a.value ?? -1))
  if (opts.sort === 'vendor') rows.sort((a, b) => a.vendorName.localeCompare(b.vendorName))
  return rows
}

export async function loadContract(client: Client, id: string): Promise<ContractDetail | null> {
  const { data } = await client.from('contracts').select(SELECT).eq('id', id).eq('is_deleted', false).returns<Raw[]>().maybeSingle()
  if (!data) return null
  const name = data.document_path ? data.document_path.slice(data.document_path.lastIndexOf('/') + 1).replace(/^[0-9a-f-]{36}-/, '') : null
  return {
    ...toRow(data),
    department: data.rfps?.department ?? '',
    paymentTerms: data.payment_terms,
    documentName: name,
    hasDocument: Boolean(data.document_path),
    terminatedAt: data.terminated_at,
    terminationReason: data.termination_reason,
    vendorEmail: data.vendor_accounts?.email ?? '',
  }
}

/** Status after an edit: never touches Terminated; outside the alert window → Active again;
 * past the end date → Expired. Entering the window is left to the daily cron, which alerts. */
export function statusAfterEdit(current: ContractStatus, endDate: string, alertDays: number): ContractStatus {
  if (current === 'terminated') return current
  const days = daysUntil(endDate)
  if (days <= 0) return 'expired'
  if (days > alertDays) return 'active'
  return current === 'expired' ? 'expiring_soon' : current
}
