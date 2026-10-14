import { createAdminClient } from '@/lib/supabase/server'

// Decision S-2: cap invite emails per organisation so a throwaway org can't use our domain
// as a spam / phishing relay. Each send is reserved atomically in the database (migration
// 0029, per-org advisory lock) BEFORE the email goes out, so parallel requests can't
// overshoot. Phase 5 vendor invites must reserve through here too.
export const INVITE_DAILY_LIMIT = 20
export const INVITE_LIMIT_MESSAGE = 'Invite limit reached for today. Try again tomorrow.'

/** Reserves one invite email for the org. False means the 24 h limit is reached. */
export async function reserveInviteEmail(orgId: string, actorId: string): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc('reserve_invite_email', {
    p_org_id: orgId,
    p_actor_id: actorId,
    p_limit: INVITE_DAILY_LIMIT,
  })
  if (error) {
    console.error('reserveInviteEmail failed', error.message)
    return false // fail closed
  }
  return data === true
}
