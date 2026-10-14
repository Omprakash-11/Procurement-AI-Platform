import type { Metadata } from 'next'

import { PageContainer, PageHeader } from '@/components/layout/page-header'

export const metadata: Metadata = { title: 'Contracts — ProcureMaster' }

// Placeholder (Plan Phase 4). Built in Phase 9.
export default function ContractsPage() {
  return (
    <PageContainer>
      <PageHeader title="Contracts" description="Active contracts, renewals and expiries." />
    </PageContainer>
  )
}
