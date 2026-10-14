import { NextResponse } from 'next/server'

import SignupConfirmationEmail from '@/emails/signup-confirmation'
import { logActivity } from '@/lib/activity'
import { apiError, appUrl, validationError } from '@/lib/api'
import { findAuthUserByEmail } from '@/lib/auth/find-user'
import { sendEmail } from '@/lib/email/send'
import { signupSchema } from '@/lib/schemas/auth'
import { createAdminClient } from '@/lib/supabase/server'

const RESEND_COOLDOWN_SECONDS = 60
const MAX_CONFIRMATIONS_PER_DAY = 5

// POST /api/auth/signup — Backend Schema §8.1. Decisions P3-1 / P3-2 / P2-1 / S-1 (#48, #53):
// creates a NEW organisation with its PM (role forced here) as an unconfirmed user with NO
// password; whoever controls the inbox follows the emailed link and chooses the password.
// Signing up again for a still-pending signup never deletes or edits it — it only re-sends
// the link to the same inbox (≤ 1 per minute, ≤ 5 per day). The response is identical
// either way. Already-confirmed accounts get 409.
export async function POST(request: Request) {
  const parsed = signupSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return validationError(parsed.error)
  const { fullName, email, orgName } = parsed.data
  const admin = createAdminClient()

  const existing = await findAuthUserByEmail(email)

  if (existing) {
    const pendingOrgId = await pendingSignupOrg(existing.id, existing.emailConfirmed, existing.appMetadata)
    if (!pendingOrgId) {
      return apiError(409, 'email_exists', 'An account with this email already exists. Sign in instead.', {
        fields: { email: ['An account with this email already exists. Sign in instead.'] },
      })
    }
    const limited = await reserveConfirmation(pendingOrgId, existing.id)
    if (limited) return apiError(429, 'too_many_requests', limited)
    await sendConfirmation(email)
    return NextResponse.json({ status: 'confirmation_sent' }, { status: 201 })
  }

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: false,
    user_metadata: { full_name: fullName },
    // needs_password: cleared by POST /api/auth/set-password. Stripped from JWTs by the hook.
    app_metadata: { role: 'procurement_manager', org_name: orgName, full_name: fullName, needs_password: true },
  })
  if (error) {
    console.error('signup createUser failed', error.code, error.message)
    return apiError(500, 'signup_failed', 'We could not create your account. Please try again.')
  }

  const userId = created.user.id
  const { data: profile } = await admin.from('profiles').select('org_id').eq('id', userId).single()
  if (!profile) {
    await admin.auth.admin.deleteUser(userId)
    console.error('signup: profile not provisioned for', userId)
    return apiError(500, 'signup_failed', 'We could not create your account. Please try again.')
  }

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
  if (!(await reserveConfirmation(profile.org_id, userId))) await sendConfirmation(email)

  return NextResponse.json({ status: 'confirmation_sent' }, { status: 201 })
}

/** The org of a still-pending signup (unconfirmed, no password, not onboarded), else null. */
async function pendingSignupOrg(userId: string, emailConfirmed: boolean, appMetadata: Record<string, unknown>): Promise<string | null> {
  if (emailConfirmed || appMetadata.needs_password !== true) return null
  const { data: profile } = await createAdminClient()
    .from('profiles')
    .select('org_id, role, onboarding_complete')
    .eq('id', userId)
    .maybeSingle()
  if (!profile || profile.role !== 'procurement_manager' || profile.onboarding_complete) return null
  return profile.org_id
}

/**
 * Per-recipient cap (each pending signup has its own org). Reserved atomically in the DB
 * (migration 0030, #56) before any link or email is made. Returns an error message, or
 * null when the send may go ahead. Fails closed.
 */
async function reserveConfirmation(orgId: string, userId: string): Promise<string | null> {
  const { data, error } = await createAdminClient().rpc('reserve_signup_confirmation', {
    p_org_id: orgId,
    p_user_id: userId,
    p_daily_limit: MAX_CONFIRMATIONS_PER_DAY,
    p_cooldown_seconds: RESEND_COOLDOWN_SECONDS,
  })
  if (error) {
    console.error('signup: confirmation reservation failed', error.message)
    return 'We could not send the email right now. Please try again shortly.'
  }
  if (data === 'daily_limit') return 'Too many confirmation emails today. Check your inbox or try again tomorrow.'
  if (data === 'cooldown') return 'Please wait a minute before trying again.'
  return null
}

async function sendConfirmation(email: string) {
  const { data, error } = await createAdminClient().auth.admin.generateLink({ type: 'magiclink', email })
  if (error || !data.properties?.hashed_token) {
    console.error('signup: could not generate confirmation link', error?.message)
    return
  }
  const confirmUrl = appUrl(`/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}&next=/set-password`)
  try {
    await sendEmail({
      to: email,
      subject: 'Confirm your email for ProcureMaster',
      // #53: no user-supplied names — whoever signed up first chose them.
      react: SignupConfirmationEmail({ confirmUrl }),
    })
  } catch (err) {
    console.error('signup: confirmation email failed', err)
  }
}
