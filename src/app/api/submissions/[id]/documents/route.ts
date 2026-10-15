import { randomUUID } from 'node:crypto'

import { NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity'
import { apiError, validationError } from '@/lib/api'
import { MAX_UPLOAD_BYTES, uploadRequestSchema } from '@/lib/schemas/vendor-portal'
import { createAdminClient } from '@/lib/supabase/server'
import { requireVendor } from '@/lib/vendor/portal'
import { mimeForExtension, removeObject, safeFileName, typeFor, vendorDocumentDir, verifyUploadedObject, VENDOR_BUCKET } from '@/lib/vendor/storage'
import { loadOwnedSubmission } from '@/lib/vendor/submissions'

type Params = { params: Promise<{ id: string }> }

const TYPE_ERROR = 'Only PDF, DOCX, and XLSX files are supported.' // App Flow §10.2
const SIZE_ERROR = 'File exceeds the 50MB limit. Please compress or split the file.'

// POST /api/submissions/[id]/documents — Backend Schema §8.3 (vendor), two steps (P6-1):
//   { action: 'sign' }    → signed upload URL for an exact server-chosen path in this
//                           submission's folder; the browser uploads straight to Storage.
//   { action: 'confirm' } → verify the stored object (exists, ≤ 50MB, file signature), then
//                           create the document row (status 'queued'). AI processing of
//                           queued documents is wired in Phase 7.
export async function POST(request: Request, { params }: Params) {
  const auth = await requireVendor()
  if (!auth.ok) return auth.response
  const { id } = await params

  const owned = await loadOwnedSubmission(auth.userId, id)
  if (!owned) return apiError(404, 'not_found', 'Submission not found.')
  const { rfp } = owned
  if (!rfp.open || rfp.submission?.status !== 'in_progress') {
    return apiError(409, 'closed', rfp.closedReason ?? 'This submission can no longer be changed.')
  }

  const parsed = uploadRequestSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return validationError(parsed.error)
  const body = parsed.data
  const dir = vendorDocumentDir(rfp.orgId, rfp.rfpId, rfp.vendorAccountId)
  const admin = createAdminClient()

  if (body.action === 'sign') {
    const kind = typeFor(body.fileName, body.mimeType)
    if (!kind) return apiError(400, 'unsupported_type', TYPE_ERROR, { fields: { file: [TYPE_ERROR] } })
    if (body.fileSize > MAX_UPLOAD_BYTES) return apiError(400, 'too_large', SIZE_ERROR, { fields: { file: [SIZE_ERROR] } })
    const path = `${dir}/${randomUUID()}-${safeFileName(body.fileName)}`
    const { data, error } = await admin.storage.from(VENDOR_BUCKET).createSignedUploadUrl(path)
    if (error || !data) return apiError(500, 'sign_failed', 'We could not start the upload. Please try again.')
    return NextResponse.json({ path, signedUrl: data.signedUrl })
  }

  // confirm
  const kind = typeFor(body.fileName, mimeForExtension(body.fileName))
  const name = body.path.slice(dir.length + 1)
  // Only a path this route issued: {dir}/{uuid}-{safe file name}.
  const issuedShape = /^[0-9a-f-]{36}-/.test(name) && name.endsWith(`-${safeFileName(body.fileName)}`)
  if (!body.path.startsWith(`${dir}/`) || name.includes('/') || !kind || !issuedShape) {
    return apiError(400, 'invalid_path', 'The upload could not be verified. Please try again.')
  }
  const { count } = await admin.from('documents').select('id', { count: 'exact', head: true }).eq('storage_path', body.path)
  if ((count ?? 0) > 0) return apiError(409, 'already_confirmed', 'This file was already added.')

  const verified = await verifyUploadedObject(body.path, kind)
  if (!verified.ok) {
    await removeObject(body.path)
    return apiError(400, 'invalid_upload', verified.reason, { fields: { file: [verified.reason] } })
  }

  const { data: doc, error } = await admin
    .from('documents')
    .insert({
      org_id: rfp.orgId,
      submission_id: owned.submissionId,
      file_name: body.fileName,
      file_type: kind,
      file_size_bytes: verified.size,
      storage_path: body.path,
    })
    .select('id, file_name, file_type, file_size_bytes, created_at')
    .single()
  if (error || !doc) {
    await removeObject(body.path)
    return apiError(500, 'confirm_failed', 'We could not save the file. Please try again.')
  }

  await logActivity({
    orgId: rfp.orgId,
    actorId: rfp.vendorAccountId,
    actorType: 'vendor',
    entityType: 'document',
    entityId: doc.id,
    action: 'document.uploaded',
    description: `Document "${doc.file_name}" uploaded`,
    after: { file_name: doc.file_name, file_type: doc.file_type, file_size_bytes: doc.file_size_bytes },
    metadata: { rfp_id: rfp.rfpId, vendor_account_id: rfp.vendorAccountId, submission_id: owned.submissionId },
  })

  return NextResponse.json(
    { document: { id: doc.id, fileName: doc.file_name, fileType: doc.file_type, sizeBytes: doc.file_size_bytes, uploadedAt: doc.created_at } },
    { status: 201 }
  )
}
