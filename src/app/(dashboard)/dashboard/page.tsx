import type { Metadata } from 'next'

import { DeniedToast } from '@/components/auth/denied-toast'
import { PmDashboard } from '@/components/dashboard/pm-dashboard'
import { DhDashboard, FaDashboard } from '@/components/dashboard/role-dashboards'
import { loadPmDashboard } from '@/lib/dashboard'
import { loadDhDashboard, loadFaDashboard } from '@/lib/role-dashboards'
import { createClient } from '@/lib/supabase/server'
import { PageContainer, PageHeader } from '@/components/layout/page-header'
import { getShellUser } from '@/lib/auth/current-user'
import { ROLE_LABELS } from '@/lib/roles'
import type { UserRole } from '@/types'

export const metadata: Metadata = { title: 'Dashboard — ProcureMaster' }

// Plan Phase 4: one /dashboard that renders per role — PM (Phase 5), DH and FA (Phase 8).
const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  procurement_manager: 'Your procurement pipeline at a glance.',
  department_head: 'Track your requirements and review vendor evaluations.',
  finance_approver: 'Vendor selections waiting for your decision.',
}

type DashboardPageProps = { searchParams: Promise<{ denied?: string }> }

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const user = await getShellUser()
  const { denied } = await searchParams
  const supabase = await createClient()
  const pmData = user?.role === 'procurement_manager' ? await loadPmDashboard(supabase) : null
  const dhData = user?.role === 'department_head' ? await loadDhDashboard(supabase, user.id) : null
  const faData = user?.role === 'finance_approver' ? await loadFaDashboard(supabase) : null

  return (
    <PageContainer>
      <DeniedToast denied={denied === '1'} />
      <PageHeader title="Dashboard" description={user ? ROLE_DESCRIPTIONS[user.role] : undefined} />
      {user && (
        <p className="sr-only" data-testid="signed-in-as">
          Signed in as {user.fullName} · {ROLE_LABELS[user.role]} · {user.orgName}
        </p>
      )}
      {pmData && <PmDashboard data={pmData} />}
      {dhData && <DhDashboard data={dhData} />}
      {faData && <FaDashboard data={faData} />}
    </PageContainer>
  )
}
