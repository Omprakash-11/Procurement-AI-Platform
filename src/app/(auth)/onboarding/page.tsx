import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard'
import { CURRENCIES } from '@/lib/schemas/organisation'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Set up your workspace — ProcureMaster' }

type OnboardingPageProps = { searchParams: Promise<{ step?: string }> }

// App Flow §3.1 — PM first-login wizard (middleware already restricts /onboarding to PMs).
// Once completed, /onboarding is no longer accessible.
export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, onboarding_complete, organisations(name, currency)')
    .eq('id', userData.user.id)
    .single()
  if (!profile) redirect('/login')
  if (profile.onboarding_complete) redirect('/dashboard')

  // Invites sent so far = other members of the org (all are pending at this point).
  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', profile.org_id)
    .neq('id', userData.user.id)

  const { step } = await searchParams
  const stepNumber = step === '2' ? 2 : step === '3' ? 3 : 1
  const currency = profile.organisations?.currency
  const knownCurrency = CURRENCIES.find((c) => c === currency) ?? 'USD'

  return (
    <OnboardingWizard
      step={stepNumber}
      orgName={profile.organisations?.name ?? ''}
      currency={knownCurrency}
      invitesSent={count ?? 0}
    />
  )
}
