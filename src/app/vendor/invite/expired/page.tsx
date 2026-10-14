import type { Metadata } from 'next'

import { Card, CardDescription, CardHeader } from '@/components/ui/card'
import { inviterEmailForToken } from '@/lib/vendor/invite'

export const metadata: Metadata = { title: 'Invite expired — ProcureMaster' }

type ExpiredPageProps = { searchParams: Promise<{ invite?: string }> }

// App Flow §7 / §10.1 expired-invite page. Decision P6-5: the contact is the inviting PM.
// No further actions on this page.
export default async function VendorInviteExpiredPage({ searchParams }: ExpiredPageProps) {
  const { invite } = await searchParams
  const contact = invite ? await inviterEmailForToken(invite) : null
  return (
    <Card>
      <CardHeader className="space-y-1.5">
        <h1 className="font-heading text-4xl text-card-foreground">Invite unavailable</h1>
        <CardDescription data-testid="expired-message">
          This invite link has expired or is no longer valid. Please contact the procurement team
          {contact ? (
            <>
              {' '}
              at{' '}
              <a href={`mailto:${contact}`} className="font-medium text-primary hover:underline">
                {contact}
              </a>
            </>
          ) : null}{' '}
          to request a new invitation.
        </CardDescription>
      </CardHeader>
    </Card>
  )
}
