import type { Metadata } from 'next'
import Link from 'next/link'

import { ContractsTable } from '@/components/contracts/contracts-table'
import { PageContainer, PageHeader } from '@/components/layout/page-header'
import { loadContracts, type ContractSort, type ContractStatus } from '@/lib/contracts'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Contracts — ProcureMaster' }

type ContractsPageProps = { searchParams: Promise<{ status?: string; sort?: string }> }

const TABS: { key: ContractStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'expiring_soon', label: 'Expiring Soon' },
  { key: 'expired', label: 'Expired' },
  { key: 'terminated', label: 'Terminated' },
]
const SORTS: { key: ContractSort; label: string }[] = [
  { key: 'end_date', label: 'End date' },
  { key: 'value', label: 'Contract value' },
  { key: 'vendor', label: 'Vendor name' },
]

// App Flow §4 Contracts List (PM): status filter tabs; sort by end date (default, ascending),
// value or vendor. Filter / sort live in the URL so the view is shareable.
export default async function ContractsPage({ searchParams }: ContractsPageProps) {
  const sp = await searchParams
  const status = TABS.some((t) => t.key === sp.status && t.key !== 'all') ? (sp.status as ContractStatus) : undefined
  const sort = SORTS.some((s) => s.key === sp.sort) ? (sp.sort as ContractSort) : 'end_date'
  const rows = await loadContracts(await createClient(), { ...(status ? { status } : {}), sort })
  const href = (next: { status?: string; sort?: string }) => {
    const p = new URLSearchParams()
    const st = next.status ?? status
    const so = next.sort ?? sort
    if (st && st !== 'all') p.set('status', st)
    if (so !== 'end_date') p.set('sort', so)
    const q = p.toString()
    return q ? `/contracts?${q}` : '/contracts'
  }
  const tabClass = (active: boolean) =>
    cn(
      'rounded-[2px] px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
    )

  return (
    <PageContainer>
      <PageHeader title="Contracts" description="Active contracts, renewals and expiries." />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Filter by status" className="inline-flex rounded bg-muted p-1">
          {TABS.map((t) => {
            const active = (t.key === 'all' && !status) || t.key === status
            return (
              <Link key={t.key} href={href({ status: t.key })} aria-current={active ? 'page' : undefined} className={tabClass(active)}>
                {t.label}
              </Link>
            )
          })}
        </nav>
        <nav aria-label="Sort contracts" className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Sort by</span>
          <span className="inline-flex rounded bg-muted p-1">
            {SORTS.map((s) => (
              <Link key={s.key} href={href({ sort: s.key })} aria-current={sort === s.key ? 'true' : undefined} className={tabClass(sort === s.key)}>
                {s.label}
              </Link>
            ))}
          </span>
        </nav>
      </div>
      <ContractsTable rows={rows} />
    </PageContainer>
  )
}
