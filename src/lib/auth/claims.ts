import type { AppClaims } from '@/types'

// Custom claims live only in the access token (not in getUser()'s app_metadata), so they are
// read from the JWT payload. Only call this on a token whose session was just validated with
// supabase.auth.getUser(). Edge-safe: uses atob, not Buffer.
export function getAppClaims(accessToken: string | undefined | null): AppClaims {
  if (!accessToken) return {}
  const payload = accessToken.split('.')[1]
  if (!payload) return {}
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const parsed: unknown = JSON.parse(json)
    if (typeof parsed !== 'object' || parsed === null) return {}
    const appMetadata = (parsed as { app_metadata?: AppClaims }).app_metadata
    return appMetadata ?? {}
  } catch {
    return {}
  }
}

/** A signed-in user with no user_type has been deactivated (the hook omits claims). */
export function homePathFor(claims: AppClaims): string | null {
  if (claims.user_type === 'internal') return '/dashboard'
  if (claims.user_type === 'vendor') return '/vendor'
  return null
}
