'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { OrgProfileForm } from '@/components/settings/org-profile-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { OrgProfileFormValues } from '@/lib/schemas/organisation'

type OrgProfileCardProps = { name: string; currency: OrgProfileFormValues['currency']; logoUrl: string | null }

// App Flow §9 Organisation Profile: Save Changes → toast "Settings saved".
export function OrgProfileCard({ name, currency, logoUrl }: OrgProfileCardProps) {
  const router = useRouter()
  return (
    <Card>
      <CardHeader>
        <CardTitle>Organisation profile</CardTitle>
        <CardDescription>Shown in the sidebar and on exported reports.</CardDescription>
      </CardHeader>
      <CardContent>
        <OrgProfileForm
          defaultName={name}
          defaultCurrency={currency}
          currentLogoUrl={logoUrl}
          submitLabel="Save Changes"
          onSaved={() => {
            toast.success('Settings saved', { duration: 4000 })
            router.refresh()
          }}
        />
      </CardContent>
    </Card>
  )
}
