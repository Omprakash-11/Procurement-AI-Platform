import { NextResponse } from 'next/server'

import TeamInviteEmail from '@/emails/team-invite'
import { logActivity } from '@/lib/activity'
import { apiError, appUrl, requireUser, validationError } from '@/lib/api'
import { issueTeamInviteToken } from '@/lib/auth/team-invite'
import { sendEmail } from '@/lib/email/send'
import { inviteTeamSchema } from '@/lib/schemas/auth'
import { createAdminClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types'

const ROLE_LABELS: Record<UserRole, string> = {
  procurement_manager: 'Procurement Manager',
  department_head: 'Department Head',
  finance_approver: 'Finance Approver',
}

type InviteResult = { email: string; status: 'sent' | 'error'; message?: string }

// POST /api/auth/invite-team — Backend Schema §8.1 (PM only). Creates the invitee as an
// unconfirmed auth user with role/org in app_metadata (the trigger creates the pending
// profile), then emails a 24 h single-use acceptance link. Re-inviting a pending invitee
// re-sends a fresh link (P3-5).
export async function POST(request: Request) {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response

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

    const userId = await resolveInvitee(email, row.role, inviter.org_id)
    if ('error' in userId) {
      results.push({ email, status: 'error', message: userId.error })
      continue
    }

    try {
      const token = await issueTeamInviteToken(userId.id)
      await sendEmail({
        to: email,
        subject: `Join ${orgName} on ProcureMaster`,
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

  // Existing account: only a still-pending invitee of this org can be re-invited.
  // generateLink is used only to look the user up by email (the link itself is discarded).
  const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  const user = link?.user
  if (!user) return { error: 'We could not invite this person. Try again.' }

  const { data: profile } = await admin.from('profiles').select('org_id, role').eq('id', user.id).maybeSingle()
  const pending = Boolean((user.app_metadata as { team_invite_hash?: string }).team_invite_hash) || !user.email_confirmed_at
  if (profile && profile.org_id === orgId && pending) {
    if (profile.role !== role) {
      await admin.from('profiles').update({ role }).eq('id', user.id)
    }
    return { id: user.id, created: false }
  }
  return { error: 'This person already has a ProcureMaster account.' }
}
