import { NextResponse } from 'next/server'

import { apiError, validationError } from '@/lib/api'
import { resetPasswordConfirmSchema } from '@/lib/schemas/auth'
import { createClient } from '@/lib/supabase/server'

// POST /api/auth/reset-password/confirm — verifies the one-time recovery link, sets the new
// password, then signs out so the user signs in fresh (App Flow §3: redirect to /login).
export async function POST(request: Request) {
  const parsed = resetPasswordConfirmSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return validationError(parsed.error)

  const supabase = await createClient()
  const { error: verifyError } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: parsed.data.tokenHash })
  if (verifyError) {
    return apiError(410, 'link_expired', 'This link has expired. Request a new one.')
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) {
    await supabase.auth.signOut()
    if (error.code === 'weak_password' || error.code === 'same_password') {
      return apiError(400, error.code, error.message, { fields: { password: [error.message] } })
    }
    return apiError(500, 'reset_failed', 'We could not update your password. Please try again.')
  }

  await supabase.auth.signOut()
  return NextResponse.json({ status: 'updated' })
}
