import type { Metadata } from 'next'

import { PageContainer, PageHeader } from '@/components/layout/page-header'

export const metadata: Metadata = { title: 'Vendor portal — ProcureMaster' }

// Placeholder: the vendor portal home (My RFPs) is built in Phase 6.
export default function VendorHomePage() {
  return (
    <PageContainer>
      <PageHeader title="Vendor portal" />
    </PageContainer>
  )
}
