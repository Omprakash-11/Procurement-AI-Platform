import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

import { createAdminClient } from '@/lib/supabase/server'

// Decision P3-5: team invite links last 24 h, longer than Supabase's 60-minute one-time
// links (shared with password reset), so the token is our own: 64 random hex chars, stored
// only as a SHA-256 hash in the user's app_metadata (service-role only; stripped from the
// JWT by the auth hook). Single-use: cleared on acceptance. URL form: `<userId>.<secret>`.
const INVITE_TTL_MS = 24 * 60 * 60 * 1000

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

export async function issueTeamInviteToken(userId: string): Promise<string> {
  const secret = randomBytes(32).toString('hex')
  const { error } = await createAdminClient().auth.admin.updateUserById(userId, {
    app_metadata: {
      team_invite_hash: sha256(secret),
      team_invite_expires_at: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
    },
  })
  if (error) throw new Error(`Could not issue invite token: ${error.message}`)
  return `${userId}.${secret}`
}

type VerifiedInvite = { userId: string; email: string }

/** Returns the invited user if the token is valid, unexpired and unused; otherwise null. */
export async function verifyTeamInviteToken(token: string): Promise<VerifiedInvite | null> {
  const [userId, secret] = token.split('.')
  if (!userId || !secret || !/^[0-9a-f-]{36}$/i.test(userId) || !/^[0-9a-f]{64}$/i.test(secret)) return null

  const { data, error } = await createAdminClient().auth.admin.getUserById(userId)
  if (error || !data.user?.email) return null

  const meta = data.user.app_metadata as { team_invite_hash?: string; team_invite_expires_at?: string }
  if (!meta.team_invite_hash || !meta.team_invite_expires_at) return null
  if (Date.parse(meta.team_invite_expires_at) < Date.now()) return null

  const expected = Buffer.from(meta.team_invite_hash, 'hex')
  const actual = Buffer.from(sha256(secret), 'hex')
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null

  return { userId, email: data.user.email }
}

export async function consumeTeamInviteToken(userId: string, password: string): Promise<void> {
  const { error } = await createAdminClient().auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
    app_metadata: { team_invite_hash: null, team_invite_expires_at: null },
  })
  if (error) throw new Error(error.message)
}
