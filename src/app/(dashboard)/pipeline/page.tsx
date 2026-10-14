import type { Metadata } from 'next'

import { PageContainer, PageHeader } from '@/components/layout/page-header'

export const metadata: Metadata = { title: 'Pipeline — ProcureMaster' }

// Placeholder (Plan Phase 4). Built in Phase 5.
export default function PipelinePage() {
  return (
    <PageContainer>
      <PageHeader title="Pipeline" description="Every active procurement, by stage." />
    </PageContainer>
  )
}
