import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity'
import { apiError, INTERNAL_ROLES, requireUser, validationError } from '@/lib/api'
import { changePasswordRequestSchema } from '@/lib/schemas/auth'

// POST /api/account/password — App Flow §9.1 "Update Password": current, new, confirm.
export async function POST(request: Request) {
  const auth = await requireUser(INTERNAL_ROLES)
  if (!auth.ok) return auth.response
  if (!auth.email) return apiError(400, 'no_email', 'Your account has no email address.')

  const parsed = changePasswordRequestSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return validationError(parsed.error)

  // Check the current password on a throwaway client, so the user's session cookies are untouched.
  const verifier = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error: verifyError } = await verifier.auth.signInWithPassword({ email: auth.email, password: parsed.data.currentPassword })
  if (verifyError) {
    return apiError(400, 'wrong_password', 'Current password is incorrect.', { fields: { currentPassword: ['Current password is incorrect.'] } })
  }
  // 'local' revokes only this throwaway session; the default ('global') would also sign the
  // user out of the session making this request.
  await verifier.auth.signOut({ scope: 'local' })

  const { error } = await auth.supabase.auth.updateUser({ password: parsed.data.password })
  if (error) {
    const message = error.code === 'same_password' ? 'Choose a password you haven’t used here before.' : error.message
    return apiError(400, error.code ?? 'password_rejected', message, { fields: { password: [message] } })
  }

  if (auth.claims.org_id) {
    await logActivity({
      orgId: auth.claims.org_id,
      actorId: auth.userId,
      actorType: 'profile',
      entityType: 'profile',
      entityId: auth.userId,
      action: 'profile.password_changed',
      description: 'Password changed',
    })
  }
  return NextResponse.json({ status: 'updated' })
}
