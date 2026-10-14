import type { Metadata } from 'next'

import { PageContainer, PageHeader } from '@/components/layout/page-header'

export const metadata: Metadata = { title: 'Approvals — ProcureMaster' }

// Placeholder (Plan Phase 4). Built in Phase 8.
export default function ApprovalsPage() {
  return (
    <PageContainer>
      <PageHeader title="Approvals" description="Vendor selections waiting for a finance decision." />
    </PageContainer>
  )
}
