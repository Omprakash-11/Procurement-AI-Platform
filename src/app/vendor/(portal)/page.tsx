import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { PageContainer, PageHeader } from '@/components/layout/page-header'
import { MyRfpsTable } from '@/components/vendor/my-rfps-table'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { listVendorRfps } from '@/lib/vendor/portal'

export const metadata: Metadata = { title: 'Vendor portal — ProcureMaster' }

// App Flow §7 Vendor Portal Home: greeting + every RFP this vendor was invited to (across
// organisations — P2-3). Whitelisted fields only (P2-4).
export default async function VendorHomePage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')

  const [rfps, { data: account }] = await Promise.all([
    listVendorRfps(data.user.id),
    createAdminClient()
      .from('vendor_accounts')
      .select('contact_name')
      .eq('auth_user_id', data.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  return (
    <PageContainer>
      <PageHeader title={`Welcome, ${account?.contact_name ?? 'there'}`} description="Proposals you've been invited to submit." />
      <section aria-labelledby="my-rfps-heading" className="space-y-4">
        <h2 id="my-rfps-heading" className="text-xl font-semibold text-foreground">
          My RFPs
        </h2>
        <MyRfpsTable rows={rfps.map((r) => ({ rfpId: r.rfpId, title: r.title, orgName: r.orgName, deadline: r.deadline, status: r.status }))} />
      </section>
    </PageContainer>
  )
}
