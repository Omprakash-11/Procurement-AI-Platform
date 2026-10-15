import type { Metadata } from 'next'
import Link from 'next/link'

import { ApprovalsTable } from '@/components/approvals/approvals-table'
import { PageContainer, PageHeader } from '@/components/layout/page-header'
import { loadApprovals } from '@/lib/approval-data'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Approvals — ProcureMaster' }

type ApprovalsPageProps = { searchParams: Promise<{ view?: string }> }

// App Flow §6 Approval Queue (FA). Filter: Pending only (default) / All.
export default async function ApprovalsPage({ searchParams }: ApprovalsPageProps) {
  const { view } = await searchParams
  const all = view === 'all'
  const rows = await loadApprovals(await createClient(), all ? {} : { status: 'pending' })

  return (
    <PageContainer>
      <PageHeader title="Approvals" description="Vendor selections waiting for a finance decision." />
      <nav aria-label="Filter approvals" className="mb-6 inline-flex rounded bg-muted p-1">
        {[
          { href: '/approvals', label: 'Pending', active: !all },
          { href: '/approvals?view=all', label: 'All', active: all },
        ].map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            aria-current={tab.active ? 'page' : undefined}
            className={cn(
              'rounded-[2px] px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              tab.active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <ApprovalsTable rows={rows} label={all ? 'All approval requests' : 'Pending approval requests'} />
    </PageContainer>
  )
}
