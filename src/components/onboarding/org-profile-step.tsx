'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { OrgProfileForm } from '@/components/settings/org-profile-form'
import type { OrgProfileFormValues } from '@/lib/schemas/organisation'

type OrgProfileStepProps = { defaultName: string; defaultCurrency: OrgProfileFormValues['currency'] }

// App Flow §3.1 step 1: Next validates and advances; "Set up later" jumps to step 3.
export function OrgProfileStep({ defaultName, defaultCurrency }: OrgProfileStepProps) {
  const router = useRouter()
  return (
    <OrgProfileForm
      defaultName={defaultName}
      defaultCurrency={defaultCurrency}
      submitLabel="Next"
      onSaved={() => {
        router.push('/onboarding?step=2')
        router.refresh()
      }}
      footerStart={
        <Link href="/onboarding?step=3" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          Set up later
        </Link>
      }
    />
  )
}
