import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Breadcrumb } from '@/components/layout/breadcrumb'
import { PageContainer } from '@/components/layout/page-header'
import { RfpDetailPanel } from '@/components/rfps/rfp-detail-panel'
import { VendorList } from '@/components/rfps/vendor-list'
import { loadRfpDetail } from '@/lib/rfps'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'RFP — ProcureMaster' }

type RfpPageProps = { params: Promise<{ id: string }> }

const INVITABLE = ['requirements_received', 'rfp_created', 'vendors_invited', 'submissions_in', 'under_evaluation']

// App Flow §4 RFP Detail — split view, ~35% details / 65% vendor list. PM only (middleware).
export default async function RfpPage({ params }: RfpPageProps) {
  const { id } = await params
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

  return (
    <>
      <Breadcrumb items={[{ label: 'Pipeline', href: '/pipeline' }, { label: detail.rfp.title }]} />
      <PageContainer>
        <div className="grid grid-cols-[minmax(0,35fr)_minmax(0,65fr)] gap-12">
          <RfpDetailPanel detail={detail} departments={departments} />
          <VendorList rfpId={id} vendors={detail.vendors} canInvite={INVITABLE.includes(detail.rfp.status)} readOnly={readOnly} />
        </div>
      </PageContainer>
    </>
  )
}
