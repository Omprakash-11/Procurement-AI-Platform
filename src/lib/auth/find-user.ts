import { createAdminClient } from '@/lib/supabase/server'

export type FoundAuthUser = {
  id: string
  emailConfirmed: boolean
  createdAt: string
  appMetadata: Record<string, unknown>
}

/** Looks up an auth user by email without issuing tokens (migration 0029, #52). */
export async function findAuthUserByEmail(email: string): Promise<FoundAuthUser | null> {
  const { data, error } = await createAdminClient().rpc('find_auth_user_by_email', { p_email: email })
  if (error) throw new Error(`User lookup failed: ${error.message}`)
  const row = data?.[0]
  if (!row) return null
  return {
    id: row.id,
    emailConfirmed: row.email_confirmed,
    createdAt: row.created_at,
    appMetadata: (row.app_metadata ?? {}) as Record<string, unknown>,
  }
}
