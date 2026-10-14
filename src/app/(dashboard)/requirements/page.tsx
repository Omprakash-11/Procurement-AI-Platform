import type { Metadata } from 'next'

import { PageContainer, PageHeader } from '@/components/layout/page-header'

export const metadata: Metadata = { title: 'Requirements — ProcureMaster' }

// Placeholder (Plan Phase 4). Built in Phase 8.
export default function RequirementsPage() {
  return (
    <PageContainer>
      <PageHeader title="Requirements" description="Procurement requirements raised by department heads." />
    </PageContainer>
  )
}
