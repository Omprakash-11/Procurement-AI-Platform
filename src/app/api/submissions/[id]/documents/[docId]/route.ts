import { NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity'
import { apiError, INTERNAL_ROLES, requireUser } from '@/lib/api'
import { createAdminClient } from '@/lib/supabase/server'
import { requireVendor } from '@/lib/vendor/portal'
import { removeObject } from '@/lib/vendor/storage'
import { loadOwnedSubmission } from '@/lib/vendor/submissions'

type Params = { params: Promise<{ id: string; docId: string }> }

// GET /api/submissions/[id]/documents/[docId] — Backend Schema §8.3 (internal): document with
// extraction status + extracted fields, for the PM's polling. RLS (documents_internal_read /
// can_read_rfp) decides access. Vendors never get extraction data.
export async function GET(_request: Request, { params }: Params) {
  const auth = await requireUser(INTERNAL_ROLES)
  if (!auth.ok) return auth.response
  const { id, docId } = await params
  const { data: doc } = await auth.supabase
    .from('documents')
    .select(
      'id, file_name, file_type, file_size_bytes, extraction_status, extraction_error, extraction_attempts, last_extracted_at, extracted_vendor_name, extracted_pricing, extracted_payment_terms, extracted_delivery, extracted_sla, extracted_warranty, extracted_termination, extracted_data_privacy, created_at'
    )
    .eq('id', docId)
    .eq('submission_id', id)
    .maybeSingle()
  if (!doc) return apiError(404, 'not_found', 'Document not found.')
  return NextResponse.json({ document: doc })
}

// DELETE /api/submissions/[id]/documents/[docId] — Backend Schema §8.3 (vendor), only while the
// submission is still a draft. Decision P6-2: the draft file and its row are deleted for good.
export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireVendor()
  if (!auth.ok) return auth.response
  const { id, docId } = await params

  const owned = await loadOwnedSubmission(auth.userId, id)
  if (!owned) return apiError(404, 'not_found', 'Document not found.')
  if (owned.rfp.submission?.status !== 'in_progress') {
    return apiError(409, 'locked', 'Your proposal has been submitted and can no longer be changed.')
  }

  const admin = createAdminClient()
  const { data: doc } = await admin.from('documents').select('id, file_name, storage_path').eq('id', docId).eq('submission_id', id).maybeSingle()
  if (!doc) return apiError(404, 'not_found', 'Document not found.')

  await removeObject(doc.storage_path)
  const { error } = await admin.from('documents').delete().eq('id', docId)
  if (error) return apiError(500, 'delete_failed', 'We could not remove the file. Please try again.')

  await logActivity({
    orgId: owned.rfp.orgId,
    actorId: owned.rfp.vendorAccountId,
    actorType: 'vendor',
    entityType: 'document',
    entityId: docId,
    action: 'document.removed',
    description: `Draft document "${doc.file_name}" removed by the vendor`,
    before: { file_name: doc.file_name },
    metadata: { rfp_id: owned.rfp.rfpId, vendor_account_id: owned.rfp.vendorAccountId, submission_id: id },
  })
  return NextResponse.json({ status: 'removed' })
}
