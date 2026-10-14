import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { AccountProfileForm, ChangePasswordForm } from '@/components/account/account-forms'
import { PageContainer, PageHeader } from '@/components/layout/page-header'
import { getShellUser } from '@/lib/auth/current-user'

export const metadata: Metadata = { title: 'My account — ProcureMaster' }

// App Flow §9.1 Personal Account (decision P4-8). The per-event email notification
// preferences section waits for #15 (no table exists for them yet).
export default async function AccountPage() {
  const user = await getShellUser()
  if (!user) redirect('/login')

  return (
    <PageContainer>
      <PageHeader title="My account" description="Your profile and sign-in details." />
      <div className="space-y-12">
        <AccountProfileForm fullName={user.fullName} email={user.email} avatarUrl={user.avatarUrl} />
        <ChangePasswordForm />
      </div>
    </PageContainer>
  )
}
