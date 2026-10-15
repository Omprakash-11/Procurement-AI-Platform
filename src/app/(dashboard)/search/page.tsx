import type { Metadata } from 'next'

import { PageContainer, PageHeader } from '@/components/layout/page-header'
import { SearchResultsView } from '@/components/search/search-results'
import { getShellUser } from '@/lib/auth/current-user'
import { runSearch } from '@/lib/search'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Search — ProcureMaster' }

type SearchPageProps = { searchParams: Promise<{ q?: string }> }

// App Flow §8.1 search results page (decision P10-1): up to 50 per category, RLS-scoped; the
// PM also sees contracts (the only role with a Contracts page).
export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q = '' } = await searchParams
  const query = q.trim().slice(0, 100)
  const user = await getShellUser()
  const results = user ? await runSearch(await createClient(), query, user.role, 50) : { rfps: [], vendors: [], contracts: [] }

  return (
    <PageContainer>
      <PageHeader title="Search" description={query ? `Results for “${query}”` : 'Type in the search box above to find RFPs, vendors and contracts.'} />
      <SearchResultsView results={results} showContracts={user?.role === 'procurement_manager'} />
    </PageContainer>
  )
}
