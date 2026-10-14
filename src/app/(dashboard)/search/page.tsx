import type { Metadata } from 'next'

import { PageContainer, PageHeader } from '@/components/layout/page-header'

export const metadata: Metadata = { title: 'Search — ProcureMaster' }

type SearchPageProps = { searchParams: Promise<{ q?: string }> }

// App Flow §8.1 search results — placeholder; the results come with the search API.
export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams
  return (
    <PageContainer>
      <PageHeader title="Search" description={q ? `Results for “${q}”` : undefined} />
    </PageContainer>
  )
}
