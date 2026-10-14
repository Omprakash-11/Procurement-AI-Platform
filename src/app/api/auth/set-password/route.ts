import { NextResponse } from 'next/server'

import { apiError, requireUser, validationError } from '@/lib/api'
import { userNeedsPassword } from '@/lib/auth/needs-password'
import { setPasswordRequestSchema } from '@/lib/schemas/auth'
import { createAdminClient } from '@/lib/supabase/server'

// POST /api/auth/set-password — decision S-1. Only for a just-confirmed signup that has no
// password yet; it is not a way to change a password without knowing the current one.
export async function POST(request: Request) {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response

  const parsed = setPasswordRequestSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return validationError(parsed.error)

  if (!(await userNeedsPassword(auth.userId))) {
    return apiError(403, 'password_already_set', 'Your password is already set.')
  }

  const { error } = await createAdminClient().auth.admin.updateUserById(auth.userId, {
    password: parsed.data.password,
    app_metadata: { needs_password: null },
  })
  if (error) {
    return apiError(400, error.code ?? 'password_rejected', error.message, { fields: { password: [error.message] } })
  }

  // Changing the password revokes the link-based session; sign in again with the new one.
  if (!auth.email) return NextResponse.json({ redirectTo: '/login' })
  const { error: signInError } = await auth.supabase.auth.signInWithPassword({ email: auth.email, password: parsed.data.password })
  if (signInError) return NextResponse.json({ redirectTo: '/login' })
  return NextResponse.json({ redirectTo: '/onboarding' })
}
