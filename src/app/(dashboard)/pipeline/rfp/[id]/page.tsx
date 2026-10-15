import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ActivityFeed } from '@/components/activity/activity-feed'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { PageContainer } from '@/components/layout/page-header'
import { RfpDetailPanel } from '@/components/rfps/rfp-detail-panel'
import { VendorList } from '@/components/rfps/vendor-list'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { loadApprovalOptions } from '@/lib/approval-options'
import { loadRfpDetail } from '@/lib/rfps'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'RFP — ProcureMaster' }

type RfpPageProps = { params: Promise<{ id: string }>; searchParams: Promise<{ inviteEmail?: string; inviteCompany?: string }> }

const INVITABLE = ['requirements_received', 'rfp_created', 'vendors_invited', 'submissions_in', 'under_evaluation']

// App Flow §4 RFP Detail — split view, ~35% details / 65% vendor list. PM only (middleware).
export default async function RfpPage({ params, searchParams }: RfpPageProps) {
  const { id } = await params
  const { inviteEmail, inviteCompany } = await searchParams
  const supabase = await createClient()
  const detail = await loadRfpDetail(supabase, id)
  if (!detail) notFound()

  // Decision P5-3: department suggestions from departments already used in the org.
  const [{ data: rfpDepts }, { data: reqDepts }] = await Promise.all([
    supabase.from('rfps').select('department').eq('is_deleted', false),
    supabase.from('requirements').select('department').eq('is_deleted', false),
  ])
  const departments = [...new Set([...(rfpDepts ?? []), ...(reqDepts ?? [])].map((d) => d.department))].sort((a, b) => a.localeCompare(b))
  const readOnly = detail.rfp.status === 'archived'
  const approval = detail.evaluation?.reportGeneratedAt ? await loadApprovalOptions(supabase, id) : null

  return (
    <>
      <Breadcrumb items={[{ label: 'Pipeline', href: '/pipeline' }, { label: detail.rfp.title }]} />
      <PageContainer>
        <div className="grid grid-cols-[minmax(0,35fr)_minmax(0,65fr)] gap-12">
          {/* App Flow §8.2: per-RFP activity as a tab on the left panel. */}
          <Tabs defaultValue="details">
            <TabsList className="mb-6 rounded bg-muted p-1">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
            <TabsContent value="details">
              <RfpDetailPanel detail={detail} departments={departments} approval={approval} />
            </TabsContent>
            <TabsContent value="activity">
              <ActivityFeed scope={{ rfpId: id }} label="RFP activity" />
            </TabsContent>
          </Tabs>
          <VendorList rfpId={id} vendors={detail.vendors} canInvite={INVITABLE.includes(detail.rfp.status)}
            readOnly={readOnly}
            initialInvite={inviteEmail ? { email: inviteEmail.slice(0, 254), companyName: (inviteCompany ?? '').slice(0, 200) } : undefined}
          />
        </div>
      </PageContainer>
    </>
  )
}
