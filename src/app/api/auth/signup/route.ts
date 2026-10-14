import type { User } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

import SignupConfirmationEmail from '@/emails/signup-confirmation'
import { logActivity } from '@/lib/activity'
import { apiError, appUrl, validationError } from '@/lib/api'
import { sendEmail } from '@/lib/email/send'
import { signupSchema } from '@/lib/schemas/auth'
import { createAdminClient } from '@/lib/supabase/server'

const RESIGNUP_COOLDOWN_MS = 60_000

// POST /api/auth/signup — Backend Schema §8.1. Decisions P3-1 / P3-2 / P2-1 / S-1:
// always creates a NEW organisation with its PM (role forced here, never from the client),
// as an unconfirmed user with NO password. Whoever controls the inbox follows the emailed
// link and chooses the password at /set-password, so nobody can pre-set a victim's password.
export async function POST(request: Request) {
  const parsed = signupSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return validationError(parsed.error)
  const { fullName, email, orgName } = parsed.data
  const admin = createAdminClient()

  let created = await createPendingPm(email, fullName, orgName)

  if ('exists' in created) {
    // S-1: an unconfirmed signup that never finished is replaced, so a stranger's pending
    // signup can't lock the real owner out. Confirmed accounts are never touched.
    const pending = await findReplaceablePendingSignup(email)
    if (pending === 'cooldown') {
      return apiError(429, 'too_many_requests', 'Please wait a minute before trying again.')
    }
    if (!pending) {
      return apiError(409, 'email_exists', 'An account with this email already exists. Sign in instead.', {
        fields: { email: ['An account with this email already exists. Sign in instead.'] },
      })
    }
    await admin.auth.admin.deleteUser(pending.userId) // cascades to the profile
    await admin.from('organisations').delete().eq('id', pending.orgId)
    created = await createPendingPm(email, fullName, orgName)
  }

  if (!('user' in created)) {
    return apiError(500, 'signup_failed', 'We could not create your account. Please try again.')
  }

  const userId = created.user.id
  const { data: profile } = await admin.from('profiles').select('org_id').eq('id', userId).single()
  if (!profile) {
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

type CreateResult = { user: User } | { exists: true } | { failed: true }

async function createPendingPm(email: string, fullName: string, orgName: string): Promise<CreateResult> {
  const { data, error } = await createAdminClient().auth.admin.createUser({
    email,
    email_confirm: false,
    user_metadata: { full_name: fullName },
    // needs_password: cleared by POST /api/auth/set-password. Stripped from JWTs by the hook.
    app_metadata: { role: 'procurement_manager', org_name: orgName, full_name: fullName, needs_password: true },
  })
  if (!error) return { user: data.user }
  if (error.code === 'email_exists') return { exists: true }
  console.error('signup createUser failed', error.code, error.message)
  return { failed: true }
}

/** A still-unconfirmed signup PM with nothing set up yet, or 'cooldown' if it is too recent. */
async function findReplaceablePendingSignup(email: string): Promise<{ userId: string; orgId: string } | 'cooldown' | null> {
  const admin = createAdminClient()
  // generateLink is used only to look the user up by email; the link is discarded.
  const { data } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  const user = data?.user
  if (!user || user.email_confirmed_at || !(user.app_metadata as { needs_password?: boolean }).needs_password) return null

  const { data: profile } = await admin.from('profiles').select('org_id, role, onboarding_complete').eq('id', user.id).maybeSingle()
  if (!profile || profile.role !== 'procurement_manager' || profile.onboarding_complete) return null

  const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('org_id', profile.org_id)
  if (count !== 1) return null

  if (Date.now() - Date.parse(user.created_at) < RESIGNUP_COOLDOWN_MS) return 'cooldown'
  return { userId: user.id, orgId: profile.org_id }
}

async function sendConfirmation(email: string, fullName: string, orgName: string) {
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
      react: SignupConfirmationEmail({ fullName, orgName, confirmUrl }),
    })
  } catch (err) {
    console.error('signup: confirmation email failed', err)
  }
}
