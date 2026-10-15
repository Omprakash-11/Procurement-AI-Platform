import type { SupabaseClient } from '@supabase/supabase-js'
import { differenceInCalendarDays, startOfDay, startOfMonth, subDays } from 'date-fns'

import { loadApprovals, type ApprovalRow } from '@/lib/approval-data'
import type { Database, Enums } from '@/types'

// Plan Phase 8 role dashboards. Read with the user's client; RLS scopes everything (DH: own
// requirements and their RFPs; FA: approvals; activity per P9-2). Sparklines follow P5-4:
// daily counts of the related activity events over the last 30 days.

type Client = SupabaseClient<Database>
const DAYS = 30

async function sparks(client: Client, groups: Record<string, string[]>): Promise<Record<string, number[]>> {
  const today = startOfDay(new Date())
  const { data } = await client
    .from('activity_log')
    .select('action, created_at')
    .in('action', Object.values(groups).flat())
    .gte('created_at', subDays(today, DAYS - 1).toISOString())
  const out: Record<string, number[]> = {}
  for (const [key, actions] of Object.entries(groups)) {
    const counts = new Array<number>(DAYS).fill(0)
    for (const row of data ?? []) {
      if (!actions.includes(row.action)) continue
      const i = DAYS - 1 - differenceInCalendarDays(today, new Date(row.created_at))
      if (i >= 0 && i < DAYS) counts[i] = (counts[i] ?? 0) + 1
    }
    out[key] = counts
  }
  return out
}

// ── Department Head (App Flow §5) ────────────────────────────────────────────

export type DhRequirement = { id: string; title: string; status: Enums<'requirement_status'>; updatedAt: string; rfpId: string | null }
export type DhDashboardData = {
  stats: { open: number; awaitingReview: number; completedThisMonth: number }
  spark: { open: number[]; awaitingReview: number[]; completed: number[] }
  requirements: DhRequirement[]
  readyForReview: { rfpId: string; rfpTitle: string; requirementTitle: string; generatedAt: string }[]
}

export async function loadDhDashboard(client: Client, userId: string): Promise<DhDashboardData> {
  const { data: reqs } = await client
    .from('requirements')
    .select('id, title, status, updated_at, linked_rfp_id')
    .eq('raised_by', userId)
    .eq('is_deleted', false)
    .order('updated_at', { ascending: false })
  const rows = reqs ?? []
  const rfpIds = rows.map((r) => r.linked_rfp_id).filter((id): id is string => Boolean(id))
  const { data: evals } = rfpIds.length
    ? await client.from('evaluations').select('rfp_id, report_generated_at, rfps(title, status)').in('rfp_id', rfpIds).not('report_generated_at', 'is', null)
    : { data: [] }
  const monthStart = startOfMonth(new Date()).toISOString()
  // "Awaiting my review": reports ready on RFPs that haven't reached a decision yet.
  const ready = (evals ?? [])
    .filter((e) => e.rfps && !['contracted', 'archived'].includes(e.rfps.status))
    .map((e) => ({
      rfpId: e.rfp_id,
      rfpTitle: e.rfps?.title ?? 'RFP',
      requirementTitle: rows.find((r) => r.linked_rfp_id === e.rfp_id)?.title ?? '',
      generatedAt: e.report_generated_at!,
    }))

  const s = await sparks(client, {
    open: ['requirement.submitted'],
    awaitingReview: ['report.generated'],
    completed: ['requirement.status_changed'],
  })
  return {
    stats: {
      open: rows.filter((r) => ['draft', 'submitted', 'in_progress'].includes(r.status)).length,
      awaitingReview: ready.length,
      completedThisMonth: rows.filter((r) => ['vendor_selected', 'closed'].includes(r.status) && r.updated_at >= monthStart).length,
    },
    spark: { open: s.open!, awaitingReview: s.awaitingReview!, completed: s.completed! },
    requirements: rows.slice(0, 8).map((r) => ({ id: r.id, title: r.title, status: r.status, updatedAt: r.updated_at, rfpId: r.linked_rfp_id })),
    readyForReview: ready,
  }
}

// ── Finance Approver (App Flow §6) ───────────────────────────────────────────

export type FaDashboardData = {
  stats: { pending: number; approvedThisMonth: number; rejectedThisMonth: number; avgDecisionHours: number | null }
  spark: { pending: number[]; approved: number[]; rejected: number[]; decisions: number[] }
  pending: ApprovalRow[]
}

export async function loadFaDashboard(client: Client): Promise<FaDashboardData> {
  const all = await loadApprovals(client)
  const monthStart = startOfMonth(new Date()).toISOString()
  const decided = all.filter((a) => a.decidedAt && (a.status === 'approved' || a.status === 'rejected'))
  const hours = decided.map((a) => (new Date(a.decidedAt!).getTime() - new Date(a.submittedAt).getTime()) / 3_600_000)
  const s = await sparks(client, {
    pending: ['approval.submitted'],
    approved: ['approval.approved'],
    rejected: ['approval.rejected'],
    decisions: ['approval.approved', 'approval.rejected'],
  })
  return {
    stats: {
      pending: all.filter((a) => a.status === 'pending').length,
      approvedThisMonth: decided.filter((a) => a.status === 'approved' && a.decidedAt! >= monthStart).length,
      rejectedThisMonth: decided.filter((a) => a.status === 'rejected' && a.decidedAt! >= monthStart).length,
      avgDecisionHours: hours.length ? hours.reduce((x, y) => x + y, 0) / hours.length : null,
    },
    spark: { pending: s.pending!, approved: s.approved!, rejected: s.rejected!, decisions: s.decisions! },
    pending: all.filter((a) => a.status === 'pending').sort((a, b) => a.slaDueAt.localeCompare(b.slaDueAt)),
  }
}

/** "2.5 days" / "6 hours" for the Average Decision Time card. */
export function formatDuration(hours: number | null): string {
  if (hours === null) return '—'
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`
  if (hours < 48) return `${Math.round(hours)} h`
  return `${(hours / 24).toFixed(1)} days`
}
