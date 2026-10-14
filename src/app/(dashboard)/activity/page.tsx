import type { Metadata } from 'next'

import { PageContainer, PageHeader } from '@/components/layout/page-header'

export const metadata: Metadata = { title: 'Activity — ProcureMaster' }

// Placeholder (Plan Phase 4). Built in Phase 9.
export default function ActivityPage() {
  return (
    <PageContainer>
      <PageHeader title="Activity" description="Everything that has happened across your organisation." />
    </PageContainer>
  )
}
