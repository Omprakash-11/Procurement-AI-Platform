import type { Metadata } from 'next'

import { DeniedToast } from '@/components/auth/denied-toast'
import { PageContainer, PageHeader } from '@/components/layout/page-header'
import { getShellUser } from '@/lib/auth/current-user'
import { ROLE_LABELS } from '@/lib/roles'
import type { UserRole } from '@/types'

export const metadata: Metadata = { title: 'Dashboard — ProcureMaster' }

// Plan Phase 4: one /dashboard that renders per role. The role dashboards themselves are
// built in Phase 5 (PM) and Phase 8 (DH, FA).
const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  procurement_manager: 'Your procurement pipeline at a glance.',
  department_head: 'Track your requirements and review vendor evaluations.',
  finance_approver: 'Vendor selections waiting for your decision.',
}

type DashboardPageProps = { searchParams: Promise<{ denied?: string }> }

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const user = await getShellUser()
  const { denied } = await searchParams

  return (
    <PageContainer>
      <DeniedToast denied={denied === '1'} />
      <PageHeader title="Dashboard" description={user ? ROLE_DESCRIPTIONS[user.role] : undefined} />
      {user && (
        <p className="text-sm text-muted-foreground" data-testid="signed-in-as">
          Signed in as {user.fullName} · {ROLE_LABELS[user.role]} · {user.orgName}
        </p>
      )}
    </PageContainer>
  )
}
