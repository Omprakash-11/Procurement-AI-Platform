import { createAdminClient } from '@/lib/supabase/server'

// Decision S-2: cap invite emails per organisation so a throwaway org can't use our domain
// as a spam / phishing relay. Counted from activity_log (no extra infrastructure).
// Phase 5 vendor invites must log with an action listed here too.
export const INVITE_DAILY_LIMIT = 20
export const INVITE_ACTIONS = ['profile.invited', 'profile.invite_resent'] as const
export const INVITE_LIMIT_MESSAGE = 'Invite limit reached for today. Try again tomorrow.'

/** How many more invite emails this org may send in the rolling 24 hours. */
export async function remainingInvites(orgId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await createAdminClient()
    .from('activity_log')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .in('action', [...INVITE_ACTIONS])
    .gte('created_at', since)
  return Math.max(0, INVITE_DAILY_LIMIT - (count ?? 0))
}
