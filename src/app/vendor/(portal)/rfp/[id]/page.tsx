import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { PageContainer } from '@/components/layout/page-header'
import { SubmissionWorkspace } from '@/components/vendor/submission-workspace'
import { createClient } from '@/lib/supabase/server'
import { getVendorRfp, toClientRfp } from '@/lib/vendor/portal'

export const metadata: Metadata = { title: 'Submit proposal — ProcureMaster' }

type VendorRfpPageProps = { params: Promise<{ id: string }> }

// App Flow §7 Vendor — RFP Submission Page. Only RFPs this vendor was invited to.
export default async function VendorRfpPage({ params }: VendorRfpPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')
  const rfp = await getVendorRfp(data.user.id, id)
  if (!rfp) notFound()
  return (
    <PageContainer>
      <SubmissionWorkspace initial={toClientRfp(rfp)} />
    </PageContainer>
  )
}
