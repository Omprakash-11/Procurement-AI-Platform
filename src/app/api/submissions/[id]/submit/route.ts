import { waitUntil } from '@vercel/functions'
import { NextResponse } from 'next/server'

import VendorSubmittedEmail from '@/emails/vendor-submitted'
import { logActivity } from '@/lib/activity'
import { apiError, appUrl } from '@/lib/api'
import { sendEmail } from '@/lib/email/send'
import { processSubmission } from '@/lib/processing/documents'
import { createAdminClient } from '@/lib/supabase/server'
import { requireVendor } from '@/lib/vendor/portal'
import { loadOwnedSubmission } from '@/lib/vendor/submissions'

export const maxDuration = 300 // decision P7-2: document processing runs after the response

type Params = { params: Promise<{ id: string }> }

// POST /api/submissions/[id]/submit — Backend Schema §8.3 (vendor): lock the submission.
// Needs ≥ 1 document and an open RFP (P6-3). Then (P6-6): entry → Submitted, first submission
// moves the RFP to Submissions In, PM gets an in-app notification + email; processing starts.
export async function POST(_request: Request, { params }: Params) {
  const auth = await requireVendor()
  if (!auth.ok) return auth.response
  const { id } = await params

  const owned = await loadOwnedSubmission(auth.userId, id)
  if (!owned) return apiError(404, 'not_found', 'Submission not found.')
  const { rfp } = owned
  if (rfp.submission?.status !== 'in_progress') return apiError(409, 'already_submitted', 'Your proposal has already been submitted.')
  if (!rfp.open) return apiError(409, 'closed', rfp.closedReason ?? 'This RFP is no longer accepting proposals.')
  if (rfp.documents.length === 0) return apiError(400, 'no_documents', 'Upload at least one document before submitting.')

  const admin = createAdminClient()
  // Atomic lock: only an in-progress submission can be submitted, once.
  const { data: locked } = await admin
    .from('submissions')
    .update({ status: 'submitted', submitted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'in_progress')
    .select('id')
  if (!locked?.length) return apiError(409, 'already_submitted', 'Your proposal has already been submitted.')

  // Decision P7-4: the submitted documents are processed now (extraction → compliance), in
  // the background (P7-2) — the vendor's response doesn't wait for the AI.
  waitUntil(processSubmission(id))

  await admin.from('rfp_vendor_entries').update({ status: 'submitted' }).eq('id', rfp.entryId).eq('status', 'invited')

  const { data: account } = await admin.from('vendor_accounts').select('company_name').eq('id', rfp.vendorAccountId).single()
  const vendorName = account?.company_name ?? 'A vendor'
  await logActivity({
    orgId: rfp.orgId,
    actorId: rfp.vendorAccountId,
    actorType: 'vendor',
    entityType: 'submission',
    entityId: id,
    action: 'vendor.submitted',
    description: `${vendorName} submitted a proposal for "${rfp.title}"`,
    before: { status: 'in_progress' },
    after: { status: 'submitted', documents: rfp.documents.length },
    metadata: { rfp_id: rfp.rfpId, vendor_account_id: rfp.vendorAccountId },
  })

  // P5-1 event: the first submission moves the card to Submissions In.
  const { data: advanced } = await admin
    .from('rfps')
    .update({ status: 'submissions_in' })
    .eq('id', rfp.rfpId)
    .in('status', ['rfp_created', 'vendors_invited'])
    .select('id')
  if (advanced?.length) {
    await logActivity({
      orgId: rfp.orgId,
      actorId: null,
      actorType: 'system',
      entityType: 'rfp',
      entityId: rfp.rfpId,
      action: 'rfp.status_changed',
      description: `"${rfp.title}" moved to Submissions In`,
      after: { status: 'submissions_in' },
      metadata: { rfp_id: rfp.rfpId },
    })
  }

  // App Flow §8.3: Vendor submits proposal → PM, in-app + email.
  const { data: pm } = await admin
    .from('profiles')
    .select('id')
    .eq('org_id', rfp.orgId)
    .eq('role', 'procurement_manager')
    .eq('is_active', true)
    .maybeSingle()
  if (pm) {
    await admin.from('notifications').insert({
      org_id: rfp.orgId,
      recipient_id: pm.id,
      type: 'vendor_submitted',
      title: `${vendorName} submitted a proposal`,
      body: `For "${rfp.title}"`,
      entity_type: 'rfp',
      entity_id: rfp.rfpId,
    })
    const { data: pmUser } = await admin.auth.admin.getUserById(pm.id)
    if (pmUser.user?.email) {
      try {
        await sendEmail({
          to: pmUser.user.email,
          subject: 'A vendor submitted a proposal',
          react: VendorSubmittedEmail({ vendorName, rfpTitle: rfp.title, documentCount: rfp.documents.length, rfpUrl: appUrl(`/pipeline/rfp/${rfp.rfpId}`) }),
        })
      } catch (err) {
        console.error('submit: PM email failed', err)
      }
    }
  }

  return NextResponse.json({ status: 'submitted' })
}
