import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Breadcrumb } from '@/components/layout/breadcrumb'
import { PageContainer, PageHeader } from '@/components/layout/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ComplianceTab } from '@/components/vendor-detail/compliance-tab'
import { DocumentsTab } from '@/components/vendor-detail/documents-tab'
import { NotesTab } from '@/components/vendor-detail/notes-tab'
import { ScoresTab } from '@/components/vendor-detail/scores-tab'
import { loadEvaluation } from '@/lib/evaluation'
import { EVALUATION_LOCKED } from '@/lib/processing/locks'
import { VENDOR_STATUS_LABEL, VENDOR_STATUS_TONE } from '@/lib/status'
import { createClient } from '@/lib/supabase/server'
import { loadVendorDocuments, type VendorNote } from '@/lib/vendor-detail'

export const metadata: Metadata = { title: 'Vendor — ProcureMaster' }

type VendorPageProps = { params: Promise<{ id: string; vendorId: string }> }

// App Flow §4 Vendor Detail — Documents, Scores, Compliance, Notes. PM only (middleware + RLS).
// Data is loaded here for the first paint; the tabs then keep it fresh with TanStack Query.
export default async function VendorDetailPage({ params }: VendorPageProps) {
  const { id, vendorId } = await params
  const supabase = await createClient()
  const { data: entry } = await supabase
    .from('rfp_vendor_entries')
    .select('id, status, vendor_accounts(company_name, contact_name, email), rfps(title, status, is_deleted)')
    .eq('rfp_id', id)
    .eq('vendor_account_id', vendorId)
    .maybeSingle()
  if (!entry || !entry.rfps || entry.rfps.is_deleted) notFound()
  const company = entry.vendor_accounts?.company_name ?? 'Vendor'
  const locked = EVALUATION_LOCKED.includes(entry.rfps.status)

  const [documents, evaluation, { data: noteRows }] = await Promise.all([
    loadVendorDocuments(supabase, id, vendorId),
    loadEvaluation(supabase, id),
    supabase.from('vendor_notes').select('id, body, created_at, profiles(full_name)').eq('rfp_vendor_entry_id', entry.id).order('created_at', { ascending: false }),
  ])
  if (!evaluation) notFound()
  const notes: VendorNote[] = (noteRows ?? []).map((n) => ({ id: n.id, body: n.body, createdAt: n.created_at, authorName: n.profiles?.full_name ?? 'Unknown' }))

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
          <TabsContent value="documents" className="mt-6">
            <DocumentsTab rfpId={id} entryId={entry.id} initialData={documents} />
          </TabsContent>
          <TabsContent value="scores" className="mt-6">
            <ScoresTab rfpId={id} vendorAccountId={vendorId} initialData={evaluation} locked={locked} />
          </TabsContent>
          <TabsContent value="compliance" className="mt-6">
            <ComplianceTab rfpId={id} entryId={entry.id} initialData={documents} locked={locked} />
          </TabsContent>
          <TabsContent value="notes" className="mt-6">
            <NotesTab rfpId={id} entryId={entry.id} initialNotes={notes} locked={entry.rfps.status === 'archived'} />
          </TabsContent>
        </Tabs>
      </PageContainer>
    </>
  )
}
