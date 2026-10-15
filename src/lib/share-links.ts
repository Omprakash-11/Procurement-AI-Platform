import { createHash, randomBytes } from 'node:crypto'

import { createAdminClient } from '@/lib/supabase/server'

// Decision P7-6: 7-day read-only report links. Only the SHA-256 of the 64-char token is stored;
// the token itself is shown to the PM once (in the copied URL).

export const SHARE_LINK_DAYS = 7

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export function newShareToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('hex') // 64 hex chars, cryptographically random
  return { token, tokenHash: hashToken(token) }
}

/** The RFP a live (unexpired, unrevoked) token opens, or null. Service role: public route. */
export async function resolveShareToken(token: string): Promise<string | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null
  const { data } = await createAdminClient()
    .from('report_share_links')
    .select('rfp_id, expires_at, revoked_at, rfps!inner(is_deleted)')
    .eq('token_hash', hashToken(token))
    .maybeSingle()
  if (!data || data.revoked_at || data.rfps.is_deleted || new Date(data.expires_at).getTime() <= Date.now()) return null
  return data.rfp_id
}
