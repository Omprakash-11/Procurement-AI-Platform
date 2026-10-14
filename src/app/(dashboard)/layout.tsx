import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { Sidebar } from '@/components/layout/sidebar'
import { TopBar } from '@/components/layout/top-bar'
import { getShellUser } from '@/lib/auth/current-user'

// Internal app shell — Content Guidelines §5.1: grid of a fixed 256px sidebar and the content
// column, with the top bar sticky above the content. App Flow §3.1: a PM's onboarding runs
// before the dashboard is reachable.
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getShellUser()
  if (!user) redirect('/login')
  if (user.role === 'procurement_manager' && !user.onboardingComplete) redirect('/onboarding')

  return (
    <div className="grid min-h-screen grid-cols-[256px_1fr] bg-background">
      <Sidebar user={user} />
      <div className="flex min-w-0 flex-col">
        <TopBar user={user} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
