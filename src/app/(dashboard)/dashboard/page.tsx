import type { Metadata } from 'next'

import { DeniedToast } from '@/components/auth/denied-toast'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Dashboard — ProcureMaster' }

const ROLE_LABELS = {
  procurement_manager: 'Procurement Manager',
  department_head: 'Department Head',
  finance_approver: 'Finance Approver',
} as const

type DashboardPageProps = { searchParams: Promise<{ denied?: string }> }

// Placeholder until Phase 4/5 build the role dashboards. Shows who is signed in so the
// Phase 3 auth flows can be verified end to end.
export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, organisations(name)')
    .eq('id', userData.user?.id ?? '')
    .single()
  const { denied } = await searchParams

  return (
    <main className="mx-auto max-w-7xl px-8 py-8">
      <DeniedToast denied={denied === '1'} />
      <h1 className="font-heading text-3xl text-foreground">Dashboard</h1>
      {profile && (
        <p className="mt-2 text-sm text-muted-foreground" data-testid="signed-in-as">
          Signed in as {profile.full_name} · {ROLE_LABELS[profile.role]} · {profile.organisations?.name}
        </p>
      )}
    </main>
  )
}
