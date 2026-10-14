import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { VendorAcceptForm } from '@/components/vendor/vendor-accept-form'
import { Card, CardDescription, CardHeader } from '@/components/ui/card'
import { lookupVendorInvite } from '@/lib/vendor/invite'

export const metadata: Metadata = { title: 'Your invitation — ProcureMaster' }

type InvitePageProps = { params: Promise<{ token: string }> }

// App Flow §7 Vendor Invite Acceptance (public, token-gated). Expired / used → expired page.
export default async function VendorInvitePage({ params }: InvitePageProps) {
  const { token } = await params
  const invite = await lookupVendorInvite(token)
  if (!invite.valid) redirect(`/vendor/invite/expired?invite=${encodeURIComponent(token)}`)

  if (invite.mode === 'internal') {
    // Decision P6-4: internal and vendor accounts stay separate.
    return (
      <Card>
        <CardHeader className="space-y-1.5">
          <h1 className="font-heading text-4xl text-card-foreground">Use a different email</h1>
          <CardDescription>
            This email is used by a ProcureMaster team account — ask the procurement team to invite a different address.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <VendorAcceptForm
      token={token}
      mode={invite.mode}
      orgName={invite.orgName}
      rfpTitle={invite.rfpTitle}
      email={invite.email}
      companyName={invite.companyName}
      personalMessage={invite.personalMessage}
    />
  )
}
