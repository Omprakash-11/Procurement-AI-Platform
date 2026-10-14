import { findAuthUserByEmail } from '@/lib/auth/find-user'
import { createAdminClient } from '@/lib/supabase/server'

// Vendor invite validation (App Flow §7, CLAUDE.md: 64-char token, 72 h, single use —
// expiry enforced here in app logic, as Backend Schema §2.4 specifies).

export type InviteLookup =
  | {
      valid: true
      inviteId: string
      rfpId: string
      orgId: string
      vendorAccountId: string
      email: string
      companyName: string
      orgName: string
      rfpTitle: string
      personalMessage: string | null
      /** P6-4: 'create' = new account; 'login' = existing vendor login; 'internal' = refused. */
      mode: 'create' | 'login' | 'internal'
      linkedAuthUserId: string | null
    }
  | { valid: false; inviterEmail: string | null }

const TOKEN = /^[0-9a-f]{64}$/

export async function lookupVendorInvite(token: string): Promise<InviteLookup> {
  if (!TOKEN.test(token)) return { valid: false, inviterEmail: null }
  const admin = createAdminClient()
  const { data: invite } = await admin
    .from('vendor_invites')
    .select(
      'id, status, expires_at, rfp_id, org_id, invited_by, personal_message, vendor_account_id, vendor_accounts(email, company_name, auth_user_id, is_deleted), rfps(title, is_deleted), organisations(name)'
    )
    .eq('token', token)
    .maybeSingle()
  if (!invite) return { valid: false, inviterEmail: null }

  const inviterEmail = await emailOf(invite.invited_by)
  const { data: entry } = await admin
    .from('rfp_vendor_entries')
    .select('status')
    .eq('rfp_id', invite.rfp_id)
    .eq('vendor_account_id', invite.vendor_account_id)
    .maybeSingle()

  const expired = new Date(invite.expires_at) < new Date()
  if (expired && invite.status === 'pending') {
    await admin.from('vendor_invites').update({ status: 'expired' }).eq('id', invite.id).eq('status', 'pending')
  }
  const usable =
    invite.status === 'pending' &&
    !expired &&
    invite.vendor_accounts &&
    !invite.vendor_accounts.is_deleted &&
    invite.rfps &&
    !invite.rfps.is_deleted &&
    entry &&
    entry.status !== 'not_selected'
  if (!usable || !invite.vendor_accounts || !invite.rfps) return { valid: false, inviterEmail }

  const email = invite.vendor_accounts.email
  const existing = await findAuthUserByEmail(email)
  let mode: 'create' | 'login' | 'internal' = 'create'
  if (existing) {
    const { data: profile } = await admin.from('profiles').select('id').eq('id', existing.id).maybeSingle()
    mode = profile ? 'internal' : 'login'
  }

  return {
    valid: true,
    inviteId: invite.id,
    rfpId: invite.rfp_id,
    orgId: invite.org_id,
    vendorAccountId: invite.vendor_account_id,
    email,
    companyName: invite.vendor_accounts.company_name,
    orgName: invite.organisations?.name ?? '',
    rfpTitle: invite.rfps.title,
    personalMessage: invite.personal_message,
    mode,
    linkedAuthUserId: invite.vendor_accounts.auth_user_id,
  }
}

/** P6-5: the contact shown on the expired-invite page is the inviting PM's email. */
async function emailOf(profileId: string): Promise<string | null> {
  const { data } = await createAdminClient().auth.admin.getUserById(profileId)
  return data.user?.email ?? null
}

export async function inviterEmailForToken(token: string): Promise<string | null> {
  if (!TOKEN.test(token)) return null
  const { data } = await createAdminClient().from('vendor_invites').select('invited_by').eq('token', token).maybeSingle()
  return data ? emailOf(data.invited_by) : null
}
