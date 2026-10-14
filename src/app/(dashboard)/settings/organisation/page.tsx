import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { OrgProfileCard } from '@/components/settings/org-profile-card'
import { SettingsFrame } from '@/components/settings/settings-frame'
import { TeamSection } from '@/components/team/team-section'
import { getShellUser } from '@/lib/auth/current-user'
import { CURRENCIES } from '@/lib/schemas/organisation'
import { createClient } from '@/lib/supabase/server'
import { listTeamMembers } from '@/lib/team'

export const metadata: Metadata = { title: 'Organisation settings — ProcureMaster' }

// App Flow §9 Organisation Profile + Team (decision P4-8, fixes #44). PM only — enforced by
// middleware and re-checked here because listTeamMembers uses the service role.
// "Delete Organisation" (danger zone) is deferred to a later decision.
export default async function OrganisationSettingsPage() {
  const user = await getShellUser()
  if (!user || user.role !== 'procurement_manager') redirect('/dashboard?denied=1')

  const supabase = await createClient()
  const { data: org } = await supabase.from('organisations').select('name, currency').eq('id', user.orgId).single()
  const members = await listTeamMembers(user.orgId)
  const currency = CURRENCIES.find((c) => c === org?.currency) ?? 'USD'

  return (
    <SettingsFrame current="organisation">
      <OrgProfileCard name={org?.name ?? ''} currency={currency} logoUrl={user.orgLogoUrl} />
      <TeamSection members={members} />
    </SettingsFrame>
  )
}
