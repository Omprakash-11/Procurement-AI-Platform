import { randomBytes } from 'node:crypto'

import { NextResponse } from 'next/server'

import VendorInviteEmail from '@/emails/vendor-invite'
import { logActivity } from '@/lib/activity'
import { apiError, appUrl, requireUser, validationError } from '@/lib/api'
import { INVITE_LIMIT_MESSAGE, reserveInviteEmail } from '@/lib/auth/invite-limit'
import { sendEmail } from '@/lib/email/send'
import { escapeLike } from '@/lib/rfps'
import { VENDOR_INVITE_TTL_HOURS, vendorInviteSchema } from '@/lib/schemas/vendor-invite'

type Params = { params: Promise<{ id: string }> }

const DUPLICATE = 'This vendor has already been invited to this RFP.' // App Flow §10.2
const INVITABLE_STAGES = ['requirements_received', 'rfp_created', 'vendors_invited', 'submissions_in', 'under_evaluation']

// POST /api/rfps/[id]/invite-vendor — Backend Schema §8.2 (PM). Decision P2-3: one vendor
// account per (org, email), reused across the org's RFPs; each invite adds an
// rfp_vendor_entry + a vendor_invite (64-char token, 72 h, single use). S-2: the email is
// reserved against the org's daily invite quota first. P5-1: first invite → Vendors Invited.
export async function POST(request: Request, { params }: Params) {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response
  const orgId = auth.claims.org_id
  if (!orgId) return apiError(403, 'forbidden', 'You do not have permission to do that.')
  const { id: rfpId } = await params

  const parsed = vendorInviteSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return validationError(parsed.error)
  const email = parsed.data.email.toLowerCase()
  const { companyName } = parsed.data
  const personalMessage = parsed.data.personalMessage || null

  const { data: rfp } = await auth.supabase
    .from('rfps')
    .select('id, title, status, organisations(name)')
    .eq('id', rfpId)
    .eq('is_deleted', false)
    .maybeSingle()
  if (!rfp) return apiError(404, 'not_found', 'RFP not found.')
  if (!INVITABLE_STAGES.includes(rfp.status)) {
    return apiError(409, 'rfp_closed', 'Vendors can no longer be invited to this RFP.')
  }

  // Reuse the org's vendor account for this email (case-insensitive, literal match).
  const { data: existing } = await auth.supabase
    .from('vendor_accounts')
    .select('id, company_name')
    .eq('is_deleted', false)
    .ilike('email', escapeLike(email))
    .maybeSingle()

  if (existing) {
    const { count } = await auth.supabase
      .from('rfp_vendor_entries')
      .select('id', { count: 'exact', head: true })
      .eq('rfp_id', rfpId)
      .eq('vendor_account_id', existing.id)
    if ((count ?? 0) > 0) return apiError(409, 'duplicate_invite', DUPLICATE, { fields: { email: [DUPLICATE] } })
  }

  if (!(await reserveInviteEmail(orgId, auth.userId))) {
    return apiError(429, 'invite_limit', INVITE_LIMIT_MESSAGE, { fields: { email: [INVITE_LIMIT_MESSAGE] } })
  }

  let vendorAccountId = existing?.id
  if (!vendorAccountId) {
    const { data: created, error } = await auth.supabase
      .from('vendor_accounts')
      .insert({ org_id: orgId, company_name: companyName, contact_name: companyName, email })
      .select('id')
      .single()
    if (error || !created) return apiError(500, 'invite_failed', 'We could not invite this vendor. Please try again.')
    vendorAccountId = created.id
  }

  const { data: entry, error: entryError } = await auth.supabase
    .from('rfp_vendor_entries')
    .insert({ org_id: orgId, rfp_id: rfpId, vendor_account_id: vendorAccountId })
    .select('id')
    .single()
  if (entryError || !entry) {
    if (entryError?.code === '23505') return apiError(409, 'duplicate_invite', DUPLICATE, { fields: { email: [DUPLICATE] } })
    return apiError(500, 'invite_failed', 'We could not invite this vendor. Please try again.')
  }

  const token = randomBytes(32).toString('hex') // 64 chars (CLAUDE.md)
  const { error: inviteError } = await auth.supabase.from('vendor_invites').insert({
    org_id: orgId,
    rfp_id: rfpId,
    vendor_account_id: vendorAccountId,
    invited_by: auth.userId,
    token,
    personal_message: personalMessage,
    expires_at: new Date(Date.now() + VENDOR_INVITE_TTL_HOURS * 60 * 60 * 1000).toISOString(),
  })
  if (inviteError) return apiError(500, 'invite_failed', 'We could not invite this vendor. Please try again.')

  try {
    await sendEmail({
      to: email,
      subject: "You've been invited to submit a proposal on ProcureMaster",
      react: VendorInviteEmail({
        orgName: rfp.organisations?.name ?? 'A procurement team',
        rfpTitle: rfp.title,
        personalMessage,
        acceptUrl: appUrl(`/vendor/invite/${token}`),
        expiresInHours: VENDOR_INVITE_TTL_HOURS,
      }),
    })
  } catch (err) {
    console.error('invite-vendor: email failed', err)
    return apiError(502, 'email_failed', 'The vendor was added, but the invite email could not be sent.')
  }

  await logActivity({
    orgId,
    actorId: auth.userId,
    actorType: 'profile',
    entityType: 'rfp_vendor_entry',
    entityId: entry.id,
    action: 'vendor.invited',
    description: `${existing?.company_name ?? companyName} invited to "${rfp.title}"`,
    after: { email, company_name: existing?.company_name ?? companyName, status: 'invited' },
    metadata: { rfp_id: rfpId, vendor_account_id: vendorAccountId },
  })

  // P5-1: the first invite advances the card.
  if (rfp.status === 'rfp_created' || rfp.status === 'requirements_received') {
    const { error: advanceError } = await auth.supabase.from('rfps').update({ status: 'vendors_invited' }).eq('id', rfpId)
    if (!advanceError) {
      await logActivity({
        orgId,
        actorId: auth.userId,
        actorType: 'system',
        entityType: 'rfp',
        entityId: rfpId,
        action: 'rfp.status_changed',
        description: `"${rfp.title}" moved to Vendors Invited`,
        before: { status: rfp.status },
        after: { status: 'vendors_invited' },
        metadata: { rfp_id: rfpId },
      })
    }
  }

  return NextResponse.json({ entryId: entry.id, email }, { status: 201 })
}
