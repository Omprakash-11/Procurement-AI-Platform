import { createAdminClient } from '@/lib/supabase/server'

/** Decision S-1: a signup PM must choose a password (at /set-password) before onboarding. */
export async function userNeedsPassword(userId: string): Promise<boolean> {
  const { data } = await createAdminClient().auth.admin.getUserById(userId)
  return Boolean((data.user?.app_metadata as { needs_password?: boolean } | undefined)?.needs_password)
}
