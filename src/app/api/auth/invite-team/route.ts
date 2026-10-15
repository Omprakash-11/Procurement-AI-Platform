import { NextResponse } from 'next/server'

import TeamInviteEmail from '@/emails/team-invite'
import { logActivity } from '@/lib/activity'
import { apiError, appUrl, requireUser, validationError, withErrors } from '@/lib/api'
import { findAuthUserByEmail } from '@/lib/auth/find-user'
import { INVITE_LIMIT_MESSAGE, reserveInviteEmail } from '@/lib/auth/invite-limit'
import { issueTeamInviteToken } from '@/lib/auth/team-invite'
import { sendEmail } from '@/lib/email/send'
import { inviteTeamSchema } from '@/lib/schemas/auth'
import { createAdminClient } from '@/lib/supabase/server'
import { ROLE_LABELS } from '@/lib/roles'
import { demoRestricted, isDemoMode } from '@/lib/demo'

type InviteResult = { email: string; status: 'sent' | 'error'; message?: string }

// POST /api/auth/invite-team — Backend Schema §8.1 (PM only). Creates the invitee as an
// unconfirmed auth user with role/org in app_metadata (the trigger creates the pending
// profile), then emails a 24 h single-use acceptance link. Re-inviting a pending invitee
// re-sends a fresh link (P3-5).
export const POST = withErrors(async function POST(request: Request) {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response
  // Decision P12-2: shared demo accounts must stay usable for every visitor.
  if (isDemoMode()) return demoRestricted('Inviting team members')

  const parsed = inviteTeamSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return validationError(parsed.error)

  const admin = createAdminClient()
  const { data: inviter } = await admin
    .from('profiles')
    .select('full_name, org_id, organisations(name)')
    .eq('id', auth.userId)
    .single()
  if (!inviter) return apiError(403, 'forbidden', 'You do not have permission to do that.')
  const orgName = inviter.organisations?.name ?? 'your organisation'

  const seen = new Set<string>()
  const results: InviteResult[] = []

  for (const row of parsed.data.invites) {
    const email = row.email.toLowerCase()
    if (seen.has(email)) continue
    seen.add(email)

    // Reject addresses that can't be invited before spending quota on them.
    const blocked = await existingAccountBlocks(email, inviter.org_id)
    if (blocked) {
      results.push({ email, status: 'error', message: blocked })
      continue
    }

    // S-2 / #51: reserve the send atomically before creating anyone or emailing.
    if (!(await reserveInviteEmail(inviter.org_id, auth.userId))) {
      results.push({ email, status: 'error', message: INVITE_LIMIT_MESSAGE })
      continue
    }

    const userId = await resolveInvitee(email, row.role, inviter.org_id)
    if ('error' in userId) {
      results.push({ email, status: 'error', message: userId.error })
      continue
    }

    try {
      const token = await issueTeamInviteToken(userId.id)
      await sendEmail({
        to: email,
        // S-2: neutral subject — org / inviter names (user-supplied) appear only in the body.
        subject: "You've been invited to ProcureMaster",
        react: TeamInviteEmail({
          orgName,
          inviterName: inviter.full_name,
          roleLabel: ROLE_LABELS[row.role],
          acceptUrl: appUrl(`/accept-invite/${token}`),
        }),
      })
      results.push({ email, status: 'sent' })
      await logActivity({
        orgId: inviter.org_id,
        actorId: auth.userId,
        actorType: 'profile',
        entityType: 'profile',
        entityId: userId.id,
        action: userId.created ? 'profile.invited' : 'profile.invite_resent',
        description: `${inviter.full_name} invited ${email} as ${ROLE_LABELS[row.role]}`,
        after: { email, role: row.role },
      })
    } catch (err) {
      console.error('invite-team: send failed', email, err)
      results.push({ email, status: 'error', message: 'We could not send this invite. Try again.' })
    }
  }

  return NextResponse.json({ results })
})

const ALREADY_HAS_ACCOUNT = 'This person already has a ProcureMaster account.'

/** Only a still-pending invitee of this org may be re-invited. Looked up without issuing tokens (#52). */
async function pendingInviteeOf(email: string, orgId: string) {
  const user = await findAuthUserByEmail(email)
  if (!user) return { user: null, pending: false, role: null }
  const { data: profile } = await createAdminClient().from('profiles').select('org_id, role').eq('id', user.id).maybeSingle()
  const pending = Boolean(profile && profile.org_id === orgId && (user.appMetadata.team_invite_hash || !user.emailConfirmed))
  return { user, pending, role: profile?.role ?? null }
}

async function existingAccountBlocks(email: string, orgId: string): Promise<string | null> {
  const { user, pending } = await pendingInviteeOf(email, orgId)
  return user && !pending ? ALREADY_HAS_ACCOUNT : null
}

type Resolved = { id: string; created: boolean } | { error: string }

async function resolveInvitee(email: string, role: 'department_head' | 'finance_approver', orgId: string): Promise<Resolved> {
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: false,
    app_metadata: { role, org_id: orgId },
  })
  if (!error) return { id: data.user.id, created: true }
  if (error.code !== 'email_exists') {
    console.error('invite-team: createUser failed', error.code, error.message)
    return { error: 'We could not invite this person. Try again.' }
  }

  // Existing account (also covers a parallel request that created it first).
  const existing = await pendingInviteeOf(email, orgId)
  if (!existing.user) return { error: 'We could not invite this person. Try again.' }
  if (!existing.pending) return { error: ALREADY_HAS_ACCOUNT }
  if (existing.role !== role) {
    await admin.from('profiles').update({ role }).eq('id', existing.user.id)
  }
  return { id: existing.user.id, created: false }
}
