import type { Metadata } from 'next'

import { ActivityFeed } from '@/components/activity/activity-feed'
import { PageContainer, PageHeader } from '@/components/layout/page-header'
import { getShellUser } from '@/lib/auth/current-user'

export const metadata: Metadata = { title: 'Activity — ProcureMaster' }

// App Flow §8.2 Global Activity Feed (all internal roles). Decision P9-2: a DH / FA sees only
// activity about what they can already access.
export default async function ActivityPage() {
  const user = await getShellUser()
  return (
    <PageContainer>
      <PageHeader
        title="Activity"
        description={user?.role === 'procurement_manager' ? 'Everything that has happened across your organisation.' : 'Activity on the requirements, evaluations and approvals you are involved in.'}
      />
      <ActivityFeed filters label="Activity" />
    </PageContainer>
  )
}
