import type { StatusTone } from '@/components/ui/status-badge'
import type { Enums } from '@/types'

// Approval helpers shared by server and client (pure). Backend Schema §2.14, App Flow §6.

export const SLA_BUSINESS_DAYS = 3

/** Decision P8-2: + N business days in UTC — Saturdays and Sundays skipped, no holidays. */
export function addBusinessDaysUtc(from: Date, days: number): Date {
  const d = new Date(from.getTime())
  let added = 0
  while (added < days) {
    d.setUTCDate(d.getUTCDate() + 1)
    const day = d.getUTCDay()
    if (day !== 0 && day !== 6) added += 1
  }
  return d
}

export type SlaState = 'overdue' | 'due_soon' | 'ok'

/** App Flow §6: red if overdue, amber if within 24 hours, green otherwise. */
export function slaState(dueAt: string, now: Date = new Date()): SlaState {
  const ms = new Date(dueAt).getTime() - now.getTime()
  if (ms <= 0) return 'overdue'
  return ms <= 24 * 3_600_000 ? 'due_soon' : 'ok'
}

export const SLA_TONE: Record<SlaState, StatusTone> = { overdue: 'danger', due_soon: 'warning', ok: 'success' }
export const SLA_LABEL: Record<SlaState, string> = { overdue: 'Overdue', due_soon: 'Due within 24h', ok: 'On track' }

export const APPROVAL_STATUS_LABEL: Record<Enums<'approval_status'>, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  recalled: 'Recalled',
}
export const APPROVAL_STATUS_TONE: Record<Enums<'approval_status'>, StatusTone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  recalled: 'neutral',
}
