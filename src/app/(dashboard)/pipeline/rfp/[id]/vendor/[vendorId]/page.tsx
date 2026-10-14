import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Breadcrumb } from '@/components/layout/breadcrumb'
import { PageContainer, PageHeader } from '@/components/layout/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { VENDOR_STATUS_LABEL, VENDOR_STATUS_TONE } from '@/lib/status'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Vendor — ProcureMaster' }

type VendorPageProps = { params: Promise<{ id: string; vendorId: string }> }

// App Flow §4 Vendor Detail — Plan Phase 5 placeholder: four tabs (Documents, Scores,
// Compliance, Notes). Tab contents are built in Phase 7.
export default async function VendorDetailPage({ params }: VendorPageProps) {
  const { id, vendorId } = await params
  const supabase = await createClient()
  const { data: entry } = await supabase
    .from('rfp_vendor_entries')
    .select('status, vendor_accounts(company_name, contact_name, email), rfps(title, is_deleted)')
    .eq('rfp_id', id)
    .eq('vendor_account_id', vendorId)
    .maybeSingle()
  if (!entry || !entry.rfps || entry.rfps.is_deleted) notFound()
  const company = entry.vendor_accounts?.company_name ?? 'Vendor'

  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Pipeline', href: '/pipeline' },
          { label: entry.rfps.title, href: `/pipeline/rfp/${id}` },
          { label: company },
        ]}
      />
      <PageContainer>
        <PageHeader
          title={company}
          description={entry.vendor_accounts?.email}
          action={<StatusBadge tone={VENDOR_STATUS_TONE[entry.status]}>{VENDOR_STATUS_LABEL[entry.status]}</StatusBadge>}
        />
        <Tabs defaultValue="documents">
          <TabsList className="rounded bg-muted p-1">
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="scores">Scores</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>
          <TabsContent value="documents" className="mt-6" />
          <TabsContent value="scores" className="mt-6">
            {/* App Flow §4 Tab 2, before scoring */}
            <p className="text-sm text-muted-foreground">Scoring has not started for this RFP. Start evaluation from the RFP page.</p>
          </TabsContent>
          <TabsContent value="compliance" className="mt-6" />
          <TabsContent value="notes" className="mt-6" />
        </Tabs>
      </PageContainer>
    </>
  )
}
