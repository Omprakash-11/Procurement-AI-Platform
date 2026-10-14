import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { getAppClaims } from '@/lib/auth/claims'
import { createClient } from '@/lib/supabase/server'

// Internal app shell. Phase 3: auth + onboarding guard only — the sidebar / top bar shell
// is built in Phase 4. App Flow §3.1: the PM's onboarding runs before the dashboard.
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')

  const { data: sessionData } = await supabase.auth.getSession()
  const claims = getAppClaims(sessionData.session?.access_token)
  if (claims.user_type !== 'internal') redirect('/login')

  if (claims.role === 'procurement_manager') {
    const { data: profile } = await supabase.from('profiles').select('onboarding_complete').eq('id', userData.user.id).single()
    if (profile && !profile.onboarding_complete) redirect('/onboarding')
  }

  return <>{children}</>
}
