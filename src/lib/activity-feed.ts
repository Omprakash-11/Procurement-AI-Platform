import type { SupabaseClient } from '@supabase/supabase-js'

import { INTERNAL_ACTIONS } from '@/lib/dashboard'
import type { Database, Json, UserRole } from '@/types'

// App Flow §8.2 Activity Log: global feed (50 per page, infinite scroll), per RFP, per vendor
// (within an RFP) and per contract. Read with the user's client — RLS (P9-2) decides what a
// DH / FA can see.

type Client = SupabaseClient<Database>
export const PAGE_SIZE = 50

/** Event-type filter (App Flow §8.2 "filter by event type") → action prefixes. */
export const EVENT_GROUPS = {
  rfp: { label: 'RFPs', prefixes: ['rfp.'] },
  vendor: { label: 'Vendors', prefixes: ['vendor.'] },
  document: { label: 'Documents', prefixes: ['document.'] },
  evaluation: { label: 'Scoring', prefixes: ['evaluation.', 'score.'] },
  compliance: { label: 'Compliance', prefixes: ['compliance'] },
  report: { label: 'Reports', prefixes: ['report.'] },
  approval: { label: 'Approvals', prefixes: ['approval.'] },
  contract: { label: 'Contracts', prefixes: ['contract.'] },
  requirement: { label: 'Requirements', prefixes: ['requirement.'] },
} as const
export type EventGroup = keyof typeof EVENT_GROUPS

export type ActivityItem = {
  id: string
  action: string
  description: string
  actorName: string
  actorType: string | null
  createdAt: string
  href: string | null
  before: Json | null
  after: Json | null
}

type Filter = {
  rfpId?: string
  vendorAccountId?: string
  contractId?: string
  group?: EventGroup
  from?: string
  to?: string
  cursor?: string
  limit?: number
  role?: UserRole
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** Where an entry links to, for this role (DH: report pages only; FA: approvals only). */
export function activityLink(role: UserRole | undefined, entityType: string, entityId: string, metadata: unknown): string | null {
  const rfpId = (metadata as { rfp_id?: string } | null)?.rfp_id ?? (entityType === 'rfp' ? entityId : undefined)
  if (role === 'finance_approver') return entityType === 'approval_request' ? `/approvals/${entityId}` : null
  if (role === 'department_head') {
    if (entityType === 'requirement') return `/requirements/${entityId}`
    return rfpId ? `/pipeline/rfp/${rfpId}/report` : null
  }
  switch (entityType) {
    case 'requirement':
      return `/requirements/${entityId}`
    case 'contract':
      return `/contracts/${entityId}`
    case 'approval_request':
      return rfpId ? `/pipeline/rfp/${rfpId}/report` : null
    default:
      return rfpId ? `/pipeline/rfp/${rfpId}` : null
  }
}

export async function loadActivity(client: Client, f: Filter): Promise<{ items: ActivityItem[]; nextCursor: string | null }> {
  const limit = Math.min(f.limit ?? PAGE_SIZE, 100)
  let q = client
    .from('activity_log')
    .select('id, action, description, actor_id, actor_type, entity_type, entity_id, metadata, before_state, after_state, created_at')
    .not('action', 'in', `(${INTERNAL_ACTIONS.join(',')})`)
    .order('created_at', { ascending: false })
    .limit(limit + 1)

  if (f.rfpId && UUID.test(f.rfpId)) {
    q = f.vendorAccountId && UUID.test(f.vendorAccountId)
      ? q.eq('metadata->>rfp_id', f.rfpId).eq('metadata->>vendor_account_id', f.vendorAccountId)
      : q.or(`and(entity_type.eq.rfp,entity_id.eq.${f.rfpId}),metadata->>rfp_id.eq.${f.rfpId}`)
  }
  if (f.contractId && UUID.test(f.contractId)) q = q.or(`and(entity_type.eq.contract,entity_id.eq.${f.contractId}),metadata->>contract_id.eq.${f.contractId}`)
  if (f.group) q = q.or(EVENT_GROUPS[f.group].prefixes.map((p) => `action.like.${p}%`).join(','))
  if (f.from && !Number.isNaN(Date.parse(f.from))) q = q.gte('created_at', new Date(f.from).toISOString())
  if (f.to && !Number.isNaN(Date.parse(f.to))) q = q.lt('created_at', new Date(f.to).toISOString())
  if (f.cursor && !Number.isNaN(Date.parse(f.cursor))) q = q.lt('created_at', f.cursor)

  const { data } = await q
  const rows = data ?? []
  const page = rows.slice(0, limit)

  // Actor names: internal users from profiles, vendors from vendor_accounts.
  const profileIds = [...new Set(page.filter((r) => r.actor_type === 'profile' && r.actor_id).map((r) => r.actor_id!))]
  const vendorIds = [...new Set(page.filter((r) => r.actor_type === 'vendor' && r.actor_id).map((r) => r.actor_id!))]
  const [{ data: people }, { data: vendors }] = await Promise.all([
    profileIds.length ? client.from('profiles').select('id, full_name').in('id', profileIds) : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    vendorIds.length ? client.from('vendor_accounts').select('id, company_name').in('id', vendorIds) : Promise.resolve({ data: [] as { id: string; company_name: string }[] }),
  ])
  const names = new Map<string, string>([...(people ?? []).map((p) => [p.id, p.full_name] as const), ...(vendors ?? []).map((v) => [v.id, v.company_name] as const)])

  return {
    items: page.map((r) => ({
      id: r.id,
      action: r.action,
      description: r.description,
      actorName: r.actor_id ? (names.get(r.actor_id) ?? (r.actor_type === 'vendor' ? 'Vendor' : 'Team member')) : 'System',
      actorType: r.actor_type,
      createdAt: r.created_at,
      href: activityLink(f.role, r.entity_type, r.entity_id, r.metadata),
      before: r.before_state,
      after: r.after_state,
    })),
    nextCursor: rows.length > limit ? page[page.length - 1]!.created_at : null,
  }
}
