import { NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity'
import { apiError, validationError } from '@/lib/api'
import { consumeTeamInviteToken, verifyTeamInviteToken } from '@/lib/auth/team-invite'
import { acceptInviteRequestSchema } from '@/lib/schemas/auth'
import { createAdminClient, createClient } from '@/lib/supabase/server'

// POST /api/auth/accept-invite — Backend Schema §8.1. Activates the invited profile: sets
// the password and name, confirms the email, consumes the single-use token, signs in.
export async function POST(request: Request) {
  const parsed = acceptInviteRequestSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return validationError(parsed.error)
  const { token, fullName, password } = parsed.data

  const invite = await verifyTeamInviteToken(token)
  if (!invite) {
    return apiError(410, 'invite_invalid', 'This invite link has expired or is no longer valid. Ask your Procurement Manager to send a new one.')
  }

  try {
    await consumeTeamInviteToken(invite.userId, password)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not set password'
    return apiError(400, 'password_rejected', message, { fields: { password: [message] } })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .update({ full_name: fullName })
    .eq('id', invite.userId)
    .select('org_id, role')
    .single()

  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: invite.email, password })
  if (signInError) return apiError(500, 'sign_in_failed', 'Your account is ready, but we could not sign you in. Please sign in.')

  if (profile) {
    await logActivity({
      orgId: profile.org_id,
      actorId: invite.userId,
      actorType: 'profile',
      entityType: 'profile',
      entityId: invite.userId,
      action: 'profile.invite_accepted',
      description: `${fullName} joined the organisation`,
      after: { full_name: fullName, role: profile.role },
    })
  }

  return NextResponse.json({ redirectTo: '/dashboard' })
}
