import type { Metadata } from 'next'

import { AcceptInviteForm } from '@/components/auth/accept-invite-form'
import { Card, CardDescription, CardHeader } from '@/components/ui/card'
import { verifyTeamInviteToken } from '@/lib/auth/team-invite'
import { createAdminClient } from '@/lib/supabase/server'
import { ROLE_LABELS } from '@/lib/roles'

export const metadata: Metadata = { title: 'Accept invite — ProcureMaster' }

type AcceptInvitePageProps = { params: Promise<{ token: string }> }

// Decision P3-5: team invite acceptance. Validating reads but doesn't consume the token.
export default async function AcceptInvitePage({ params }: AcceptInvitePageProps) {
  const { token } = await params
  const invite = await verifyTeamInviteToken(decodeURIComponent(token))

  const { data: profile } = invite
    ? await createAdminClient()
        .from('profiles')
        .select('full_name, role, organisations(name)')
        .eq('id', invite.userId)
        .maybeSingle()
    : { data: null }

  if (!invite || !profile) {
    return (
      <Card>
        <CardHeader className="space-y-1.5">
          <h1 className="font-heading text-4xl text-card-foreground">Invite unavailable</h1>
          <CardDescription>
            This invite link has expired or is no longer valid. Ask your Procurement Manager to send a new one.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <AcceptInviteForm
      token={decodeURIComponent(token)}
      email={invite.email}
      orgName={profile.organisations?.name ?? 'your organisation'}
      roleLabel={ROLE_LABELS[profile.role]}
      // The pending profile's name defaults to the email until the invitee sets it.
      defaultFullName={profile.full_name === invite.email ? '' : profile.full_name}
    />
  )
}
