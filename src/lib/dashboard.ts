import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays, differenceInCalendarDays, format, startOfDay, subDays } from 'date-fns'

import { ACTIVE_RFP_STATUSES, type RfpStatus } from '@/lib/status'
import type { Database } from '@/types'

// Ledger / bookkeeping rows in activity_log that aren't user-facing events.
export const INTERNAL_ACTIONS = ['invite.email_sent', 'signup.confirmation_sent', 'vendor.status_emailed']

// Decision P5-4: sparkline = daily count of the related activity events, last 30 days.
const SPARK_ACTIONS = {
  activeRfps: ['rfp.created'],
  vendorsUnderEvaluation: ['vendor.invited', 'vendor.submitted'],
  pendingApprovals: ['approval.submitted'],
  contractsExpiring: ['contract.created', 'contract.renewal_alert'],
} as const
type StatKey = keyof typeof SPARK_ACTIONS

export type PmDashboard = {
  stats: Record<StatKey, { value: number; spark: number[] }>
  snapshot: { id: string; title: string; department: string; status: RfpStatus; vendorCount: number; daysSinceActivity: number }[]
  renewals: { id: string; title: string; vendor: string; endDate: string; daysRemaining: number }[]
  activity: { id: string; actorName: string; description: string; href: string | null; createdAt: string }[]
}

const DAYS = 30

// Reads with the PM's client; RLS scopes every query to their org.
export async function loadPmDashboard(supabase: SupabaseClient<Database>): Promise<PmDashboard> {
  const today = startOfDay(new Date())
  const sparkFrom = subDays(today, DAYS - 1)
  const allSparkActions = Object.values(SPARK_ACTIONS).flat()

  const [activeRfps, vendorsUnderEval, pendingApprovals, contractsExpiring, sparkRows, snapshotRows, renewalRows, activityRows, profiles] =
    await Promise.all([
      supabase.from('rfps').select('id', { count: 'exact', head: true }).eq('is_deleted', false).in('status', ACTIVE_RFP_STATUSES),
      supabase
        .from('rfp_vendor_entries')
        .select('id, rfps!inner(status, is_deleted)', { count: 'exact', head: true })
        .in('status', ['submitted', 'under_review', 'shortlisted'])
        .eq('rfps.is_deleted', false)
        .in('rfps.status', ACTIVE_RFP_STATUSES),
      supabase.from('approval_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('contracts').select('id', { count: 'exact', head: true }).eq('status', 'expiring_soon').eq('is_deleted', false),
      supabase.from('activity_log').select('action, created_at').in('action', allSparkActions).gte('created_at', sparkFrom.toISOString()),
      supabase
        .from('rfps')
        .select('id, title, department, status, updated_at, rfp_vendor_entries(count)')
        .eq('is_deleted', false)
        .in('status', ACTIVE_RFP_STATUSES)
        .order('updated_at', { ascending: false })
        .limit(5),
      supabase
        .from('contracts')
        .select('id, title, end_date, vendor_accounts(company_name)')
        .eq('is_deleted', false)
        .in('status', ['active', 'expiring_soon'])
        .lte('end_date', format(addDays(today, 90), 'yyyy-MM-dd'))
        .order('end_date', { ascending: true }),
      supabase
        .from('activity_log')
        .select('id, actor_id, entity_type, entity_id, description, metadata, created_at')
        .not('action', 'in', `(${INTERNAL_ACTIONS.join(',')})`)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase.from('profiles').select('id, full_name'),
    ])

  const byDay = (actions: readonly string[]) => {
    const counts = new Array<number>(DAYS).fill(0)
    for (const row of sparkRows.data ?? []) {
      if (!actions.includes(row.action)) continue
      const index = DAYS - 1 - differenceInCalendarDays(today, new Date(row.created_at))
      if (index >= 0 && index < DAYS) counts[index] = (counts[index] ?? 0) + 1
    }
    return counts
  }

  // "Days since last activity" for the snapshot: latest user-facing event mentioning each RFP.
  const snapshotIds = (snapshotRows.data ?? []).map((r) => r.id)
  const { data: lastEvents } = snapshotIds.length
    ? await supabase
        .from('activity_log')
        .select('metadata, created_at')
        .in('metadata->>rfp_id', snapshotIds)
        .not('action', 'in', `(${INTERNAL_ACTIONS.join(',')})`)
        .order('created_at', { ascending: false })
        .limit(200)
    : { data: [] as { metadata: unknown; created_at: string }[] }
  const lastActivity = new Map<string, string>()
  for (const e of lastEvents ?? []) {
    const rfpId = (e.metadata as { rfp_id?: string } | null)?.rfp_id
    if (rfpId && !lastActivity.has(rfpId)) lastActivity.set(rfpId, e.created_at)
  }

  const names = new Map((profiles.data ?? []).map((p) => [p.id, p.full_name]))

  return {
    stats: {
      activeRfps: { value: activeRfps.count ?? 0, spark: byDay(SPARK_ACTIONS.activeRfps) },
      vendorsUnderEvaluation: { value: vendorsUnderEval.count ?? 0, spark: byDay(SPARK_ACTIONS.vendorsUnderEvaluation) },
      pendingApprovals: { value: pendingApprovals.count ?? 0, spark: byDay(SPARK_ACTIONS.pendingApprovals) },
      contractsExpiring: { value: contractsExpiring.count ?? 0, spark: byDay(SPARK_ACTIONS.contractsExpiring) },
    },
    snapshot: (snapshotRows.data ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      department: r.department,
      status: r.status,
      vendorCount: r.rfp_vendor_entries[0]?.count ?? 0,
      daysSinceActivity: differenceInCalendarDays(today, new Date(lastActivity.get(r.id) ?? r.updated_at)),
    })),
    renewals: (renewalRows.data ?? []).map((c) => ({
      id: c.id,
      title: c.title,
      vendor: c.vendor_accounts?.company_name ?? '',
      endDate: c.end_date,
      daysRemaining: differenceInCalendarDays(new Date(`${c.end_date}T12:00:00`), today),
    })),
    activity: (activityRows.data ?? []).map((a) => ({
      id: a.id,
      actorName: a.actor_id ? (names.get(a.actor_id) ?? 'System') : 'System',
      description: a.description,
      href: activityHref(a.entity_type, a.entity_id, a.metadata),
      createdAt: a.created_at,
    })),
  }
}

export function activityHref(entityType: string, entityId: string, metadata: unknown): string | null {
  const rfpId = (metadata as { rfp_id?: string } | null)?.rfp_id
  switch (entityType) {
    case 'rfp':
      return `/pipeline/rfp/${entityId}`
    case 'requirement':
      return `/requirements/${entityId}`
    case 'contract':
      return `/contracts/${entityId}`
    case 'approval_request':
      return `/approvals/${entityId}`
    default:
      return rfpId ? `/pipeline/rfp/${rfpId}` : null
  }
}
