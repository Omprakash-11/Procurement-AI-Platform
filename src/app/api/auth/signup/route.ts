import { NextResponse } from 'next/server'

import SignupConfirmationEmail from '@/emails/signup-confirmation'
import { logActivity } from '@/lib/activity'
import { apiError, appUrl, validationError } from '@/lib/api'
import { sendEmail } from '@/lib/email/send'
import { signupSchema } from '@/lib/schemas/auth'
import { createAdminClient } from '@/lib/supabase/server'

// POST /api/auth/signup — Backend Schema §8.1. Decisions P3-1 / P3-2 / P2-1:
// always creates a NEW organisation with its PM (role forced here, never from the client),
// as an unconfirmed user who must click the emailed link before signing in.
export async function POST(request: Request) {
  const parsed = signupSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return validationError(parsed.error)
  const { fullName, email, orgName, password } = parsed.data
  const admin = createAdminClient()

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: { full_name: fullName },
    app_metadata: { role: 'procurement_manager', org_name: orgName, full_name: fullName },
  })

  if (error) {
    if (error.code === 'email_exists') {
      return apiError(409, 'email_exists', 'An account with this email already exists. Sign in instead.', {
        fields: { email: ['An account with this email already exists. Sign in instead.'] },
      })
    }
    if (error.code === 'weak_password') {
      return apiError(400, 'weak_password', error.message, { fields: { password: [error.message] } })
    }
    console.error('signup createUser failed', error.code, error.message)
    return apiError(500, 'signup_failed', 'We could not create your account. Please try again.')
  }

  const userId = created.user.id
  const { data: profile } = await admin.from('profiles').select('org_id').eq('id', userId).single()
  if (!profile) {
    // The org/profile trigger did not run — undo so the email can be reused.
    await admin.auth.admin.deleteUser(userId)
    console.error('signup: profile not provisioned for', userId)
    return apiError(500, 'signup_failed', 'We could not create your account. Please try again.')
  }

  await sendConfirmation(email, fullName, orgName)

  await logActivity({
    orgId: profile.org_id,
    actorId: userId,
    actorType: 'profile',
    entityType: 'organisation',
    entityId: profile.org_id,
    action: 'organisation.created',
    description: `${fullName} created the ${orgName} organisation`,
    after: { name: orgName },
  })

  return NextResponse.json({ status: 'confirmation_sent' }, { status: 201 })
}

async function sendConfirmation(email: string, fullName: string, orgName: string) {
  const { data, error } = await createAdminClient().auth.admin.generateLink({ type: 'magiclink', email })
  if (error || !data.properties?.hashed_token) {
    console.error('signup: could not generate confirmation link', error?.message)
    return
  }
  const confirmUrl = appUrl(`/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}&next=/onboarding`)
  try {
    await sendEmail({
      to: email,
      subject: 'Confirm your email for ProcureMaster',
      react: SignupConfirmationEmail({ fullName, orgName, confirmUrl }),
    })
  } catch (err) {
    console.error('signup: confirmation email failed', err)
  }
}
