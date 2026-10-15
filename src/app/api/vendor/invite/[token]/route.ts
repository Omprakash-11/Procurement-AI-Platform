import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity'
import { apiError, validationError, withErrors } from '@/lib/api'
import { vendorAcceptRequestSchema } from '@/lib/schemas/vendor-portal'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { lookupVendorInvite } from '@/lib/vendor/invite'

type Params = { params: Promise<{ token: string }> }

const INVALID = 'This invite link has expired or is no longer valid.'
const INTERNAL = 'This email is used by a ProcureMaster team account — ask the procurement team to invite a different address.'

// GET /api/vendor/invite/[token] — Plan Phase 6: validate the token; return what the invite
// page shows (org, RFP title, message, account mode). No internal data.
export const GET = withErrors(async function GET(_request: Request, { params }: Params) {
  const { token } = await params
  const invite = await lookupVendorInvite(token)
  if (!invite.valid) return apiError(410, 'invite_invalid', INVALID, { inviterEmail: invite.inviterEmail })
  return NextResponse.json({
    orgName: invite.orgName,
    rfpTitle: invite.rfpTitle,
    companyName: invite.companyName,
    personalMessage: invite.personalMessage,
    email: invite.email,
    mode: invite.mode,
  })
})

// POST /api/vendor/invite/[token] — accept. New vendors get a confirmed account (the emailed
// link proves the inbox — P6-4); existing vendor logins confirm with their password; internal
// emails are refused. The token is single-use (accepted atomically). Signs the vendor in.
export const POST = withErrors(async function POST(request: Request, { params }: Params) {
  const { token } = await params
  const invite = await lookupVendorInvite(token)
  if (!invite.valid) return apiError(410, 'invite_invalid', INVALID, { inviterEmail: invite.inviterEmail })
  if (invite.mode === 'internal') return apiError(409, 'internal_email', INTERNAL)

  const parsed = vendorAcceptRequestSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return validationError(parsed.error)
  const body = parsed.data
  if (body.mode !== invite.mode) return apiError(409, 'mode_mismatch', 'Please reload this page and try again.')

  const admin = createAdminClient()
  let authUserId: string

  if (body.mode === 'create') {
    const { data, error } = await admin.auth.admin.createUser({
      email: invite.email,
      password: body.password,
      email_confirm: true,
      user_metadata: { full_name: body.fullName },
    })
    if (error || !data.user) {
      if (error?.code === 'weak_password') return apiError(400, 'weak_password', error.message, { fields: { password: [error.message] } })
      console.error('vendor accept: createUser failed', error?.code, error?.message)
      return apiError(500, 'accept_failed', 'We could not set up your account. Please try again.')
    }
    authUserId = data.user.id
  } else {
    // Existing vendor login: check the password on a throwaway client (local sign-out only).
    const verifier = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data, error } = await verifier.auth.signInWithPassword({ email: invite.email, password: body.password })
    if (error || !data.user) return apiError(400, 'wrong_password', 'Incorrect password.', { fields: { password: ['Incorrect password.'] } })
    await verifier.auth.signOut({ scope: 'local' })
    authUserId = data.user.id
  }

  if (invite.linkedAuthUserId && invite.linkedAuthUserId !== authUserId) {
    return apiError(409, 'account_mismatch', INVALID)
  }

  // Single use: only one request can flip pending → accepted.
  const { data: accepted } = await admin
    .from('vendor_invites')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', invite.inviteId)
    .eq('status', 'pending')
    .select('id')
  if (!accepted?.length) {
    // Lost a race with another acceptance — don't leave a just-created account behind.
    if (body.mode === 'create') await admin.auth.admin.deleteUser(authUserId)
    return apiError(410, 'invite_invalid', INVALID)
  }

  const accountUpdate =
    body.mode === 'create'
      ? { auth_user_id: authUserId, is_active: true, contact_name: body.fullName, company_name: body.companyName }
      : { auth_user_id: authUserId, is_active: true }
  const { error: linkError } = await admin.from('vendor_accounts').update(accountUpdate).eq('id', invite.vendorAccountId)
  if (linkError) return apiError(500, 'accept_failed', 'We could not set up your account. Please try again.')

  await logActivity({
    orgId: invite.orgId,
    actorId: invite.vendorAccountId,
    actorType: 'vendor',
    entityType: 'vendor_account',
    entityId: invite.vendorAccountId,
    action: 'vendor.invite_accepted',
    description: `${body.mode === 'create' ? body.companyName : invite.companyName} accepted the invite to "${invite.rfpTitle}"`,
    metadata: { rfp_id: invite.rfpId },
  })

  // Sign in on the user's own (cookie) client now that the vendor account is active.
  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: invite.email, password: body.password })
  if (signInError) return NextResponse.json({ redirectTo: '/login' })
  return NextResponse.json({ redirectTo: `/vendor/rfp/${invite.rfpId}` })
})
