import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database, UserRole } from '@/types'

// Decision P10-1 / Backend Schema §8.9 / App Flow §8.1: global search over RFPs, vendors and
// contracts using the generated tsvector columns (CLAUDE.md: never ILIKE). Read with the user's
// client, so RLS scopes rows; results also only link to pages the role can open.

type Client = SupabaseClient<Database>

export type SearchHit = { id: string; title: string; subtitle: string; href: string }
export type SearchResults = { rfps: SearchHit[]; vendors: SearchHit[]; contracts: SearchHit[] }

/** User text → prefix tsquery ("north stor" → "north:* & stor:*"); only letters / digits kept. */
export function toPrefixQuery(q: string): string | null {
  const words = q
    .normalize('NFKC')
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)
    .slice(0, 6)
  return words.length ? words.map((w) => `${w}:*`).join(' & ') : null
}

const EMPTY: SearchResults = { rfps: [], vendors: [], contracts: [] }

export async function runSearch(client: Client, q: string, role: UserRole, limit: number): Promise<SearchResults> {
  const tsq = toPrefixQuery(q)
  if (!tsq) return EMPTY
  const isPm = role === 'procurement_manager'

  const [{ data: rfps }, { data: vendors }, { data: contracts }] = await Promise.all([
    client
      .from('rfps')
      .select('id, title, department, status')
      .eq('is_deleted', false)
      .textSearch('search_vector', tsq, { config: 'english' })
      .order('updated_at', { ascending: false })
      .limit(limit),
    client
      .from('vendor_accounts')
      .select('id, company_name, contact_name, rfp_vendor_entries(rfp_id, created_at)')
      .eq('is_deleted', false)
      .textSearch('search_vector', tsq, { config: 'english' })
      .order('company_name')
      .limit(isPm ? limit : 50),
    // FA reads contracts through the API only (P9 defaults, #22) — no page to link to.
    isPm
      ? client
          .from('contracts')
          .select('id, title, end_date, vendor_accounts(company_name)')
          .eq('is_deleted', false)
          .textSearch('search_vector', tsq, { config: 'english' })
          .order('end_date')
          .limit(limit)
      : Promise.resolve({ data: [] as { id: string; title: string; end_date: string; vendor_accounts: { company_name: string } | null }[] }),
  ])

  // Finance Approver: RFPs and vendors open on their approval request page.
  const approvalByRfp = new Map<string, string>()
  if (role === 'finance_approver') {
    const rfpIds = [...new Set([...(rfps ?? []).map((r) => r.id), ...(vendors ?? []).flatMap((v) => v.rfp_vendor_entries.map((e) => e.rfp_id))])]
    if (rfpIds.length) {
      const { data: approvals } = await client.from('approval_requests').select('id, rfp_id, created_at').in('rfp_id', rfpIds).order('created_at', { ascending: false })
      for (const a of approvals ?? []) if (!approvalByRfp.has(a.rfp_id)) approvalByRfp.set(a.rfp_id, a.id)
    }
  }

  const rfpHref = (rfpId: string): string | null => {
    if (isPm) return `/pipeline/rfp/${rfpId}`
    if (role === 'department_head') return `/pipeline/rfp/${rfpId}/report`
    const approvalId = approvalByRfp.get(rfpId)
    return approvalId ? `/approvals/${approvalId}` : null
  }

  return {
    rfps: (rfps ?? [])
      .map((r) => ({ id: r.id, title: r.title, subtitle: r.department, href: rfpHref(r.id) }))
      .filter((h): h is SearchHit => h.href !== null),
    // rfp_vendor_entries is RLS-scoped (can_read_rfp): a DH / FA only gets vendors on RFPs they
    // can read; a vendor with no visible entry is not shown to them.
    vendors: (vendors ?? [])
      .map((v) => {
        const latest = [...v.rfp_vendor_entries].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
        const href = latest ? (isPm ? `/pipeline/rfp/${latest.rfp_id}/vendor/${v.id}` : rfpHref(latest.rfp_id)) : null
        return { id: v.id, title: v.company_name, subtitle: v.contact_name, href }
      })
      .filter((h): h is SearchHit => h.href !== null)
      .slice(0, limit),
    contracts: (contracts ?? []).map((c) => ({
      id: c.id,
      title: c.title,
      subtitle: `${c.vendor_accounts?.company_name ?? 'Vendor'} · ends ${c.end_date}`,
      href: `/contracts/${c.id}`,
    })),
  }
}
