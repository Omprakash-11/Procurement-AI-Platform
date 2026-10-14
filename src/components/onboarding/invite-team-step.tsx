'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { TeamInviteForm } from '@/components/team/team-invite-form'

// App Flow §3.1 step 2: "Send Invites + Continue" or "Skip for now".
export function InviteTeamStep() {
  const router = useRouter()
  return (
    <TeamInviteForm
      submitLabel="Send Invites + Continue"
      onAllSent={() => {
        router.push('/onboarding?step=3')
        router.refresh()
      }}
      footerStart={
        <Link href="/onboarding?step=3" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          Skip for now
        </Link>
      }
    />
  )
}
