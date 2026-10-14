import { cache } from 'react'

import { getAppClaims } from '@/lib/auth/claims'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types'

export type ShellUser = {
  id: string
  email: string
  fullName: string
  role: UserRole
  avatarUrl: string | null
  orgId: string
  orgName: string
  orgLogoUrl: string | null
  onboardingComplete: boolean
}

const SIGNED_URL_TTL_SECONDS = 60 * 60

// Storage buckets are private (CLAUDE.md): images are shown through short-lived signed URLs.
// The service role signs them, so a stored path is never trusted (#59): it must match the
// exact shape this org's server routes write.
async function signedOrgAsset(path: string | null, allowed: RegExp): Promise<string | null> {
  if (!path || !allowed.test(path)) return null
  const { data } = await createAdminClient().storage.from('org-assets').createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  return data?.signedUrl ?? null
}

const exact = (pattern: string) => new RegExp(`^${pattern}$`)
// org / user ids are UUIDs from the database (hex and dashes), so they are safe inside a RegExp.
export const logoPathPattern = (orgId: string) => exact(`${orgId}/logo\\.(png|jpg|webp)`)
export const avatarPathPattern = (orgId: string, userId: string) => exact(`${orgId}/avatars/${userId}\\.(png|jpg|webp)`)

/** The signed-in internal user for the app shell, or null. Cached per request. */
export const getShellUser = cache(async (): Promise<ShellUser | null> => {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return null
  const { data: sessionData } = await supabase.auth.getSession()
  if (getAppClaims(sessionData.session?.access_token).user_type !== 'internal') return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, avatar_url, org_id, onboarding_complete, organisations(name, logo_url)')
    .eq('id', userData.user.id)
    .single()
  if (!profile) return null

  const [avatarUrl, orgLogoUrl] = await Promise.all([
    signedOrgAsset(profile.avatar_url, avatarPathPattern(profile.org_id, userData.user.id)),
    signedOrgAsset(profile.organisations?.logo_url ?? null, logoPathPattern(profile.org_id)),
  ])

  return {
    id: userData.user.id,
    email: userData.user.email ?? '',
    fullName: profile.full_name,
    role: profile.role,
    avatarUrl,
    orgId: profile.org_id,
    orgName: profile.organisations?.name ?? '',
    orgLogoUrl,
    onboardingComplete: profile.onboarding_complete,
  }
})

