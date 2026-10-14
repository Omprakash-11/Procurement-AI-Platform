import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { VendorShell } from '@/components/layout/vendor-shell'
import { getAppClaims } from '@/lib/auth/claims'
import { createClient } from '@/lib/supabase/server'

// Signed-in vendor portal (App Flow §7). The public invite pages (/vendor/invite/*) live
// outside this route group, so they don't get the shell.
export default async function VendorPortalLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')
  const { data: sessionData } = await supabase.auth.getSession()
  if (getAppClaims(sessionData.session?.access_token).user_type !== 'vendor') redirect('/login')

  // A vendor may work with several organisations (P2-3). Show the company name from their most
  // recent invitation (default agreed in Phase 4). RLS returns only the vendor's own rows.
  const { data: latestEntry } = await supabase
    .from('rfp_vendor_entries')
    .select('vendor_accounts(company_name, contact_name)')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  let account = latestEntry?.vendor_accounts ?? null
  if (!account) {
    const { data } = await supabase
      .from('vendor_accounts')
      .select('company_name, contact_name')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    account = data
  }

  return (
    <VendorShell
      companyName={account?.company_name ?? ''}
      contactName={account?.contact_name ?? userData.user.email ?? ''}
      email={userData.user.email ?? ''}
    >
      {children}
    </VendorShell>
  )
}
