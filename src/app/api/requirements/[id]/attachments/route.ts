import { randomUUID } from 'node:crypto'

import { NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity'
import { apiError, requireUser, validationError, withErrors } from '@/lib/api'
import { ATTACHMENT_BUCKET, removeAttachmentObject, requirementDir } from '@/lib/requirement-files'
import { ATTACHMENT_SIZE_ERROR, attachmentUploadSchema, MAX_ATTACHMENT_BYTES } from '@/lib/schemas/requirement'
import { createAdminClient } from '@/lib/supabase/server'
import { mimeForExtension, safeFileName, typeFor, verifyUploadedObject } from '@/lib/vendor/storage'

type Params = { params: Promise<{ id: string }> }

const TYPE_ERROR = 'Only PDF, DOCX, and XLSX files are supported.' // App Flow §10.2

// POST /api/requirements/[id]/attachments — decision P8-4, same two steps as vendor uploads
// (P6-1): 'sign' returns a signed upload URL for a server-chosen path; 'confirm' checks the
// stored object (exists, ≤ 20MB, file signature) and records it. Only the DH who raised the
// requirement, while it is still editable (Draft / Submitted).
export const POST = withErrors(async function POST(request: Request, { params }: Params) {
  const auth = await requireUser(['department_head'])
  if (!auth.ok) return auth.response
  const { id } = await params

  const { data: req } = await auth.supabase.from('requirements').select('id, org_id, title, status, raised_by, linked_rfp_id').eq('id', id).eq('is_deleted', false).maybeSingle()
  if (!req || req.raised_by !== auth.userId) return apiError(404, 'not_found', 'Requirement not found.')
  if (!['draft', 'submitted'].includes(req.status) || req.linked_rfp_id) return apiError(409, 'locked', 'This requirement can no longer be changed.')

  const parsed = attachmentUploadSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return validationError(parsed.error)
  const body = parsed.data
  const dir = requirementDir(req.org_id, id)
  const admin = createAdminClient()

  if (body.action === 'sign') {
    const kind = typeFor(body.fileName, body.mimeType)
    if (!kind) return apiError(400, 'unsupported_type', TYPE_ERROR, { fields: { file: [TYPE_ERROR] } })
    if (body.fileSize > MAX_ATTACHMENT_BYTES) return apiError(400, 'too_large', ATTACHMENT_SIZE_ERROR, { fields: { file: [ATTACHMENT_SIZE_ERROR] } })
    const path = `${dir}/${randomUUID()}-${safeFileName(body.fileName)}`
    const { data, error } = await admin.storage.from(ATTACHMENT_BUCKET).createSignedUploadUrl(path)
    if (error || !data) return apiError(500, 'sign_failed', 'We could not start the upload. Please try again.')
    return NextResponse.json({ path, signedUrl: data.signedUrl })
  }

  const kind = typeFor(body.fileName, mimeForExtension(body.fileName))
  const name = body.path.slice(dir.length + 1)
  const issuedShape = /^[0-9a-f-]{36}-/.test(name) && name.endsWith(`-${safeFileName(body.fileName)}`)
  if (!body.path.startsWith(`${dir}/`) || name.includes('/') || !kind || !issuedShape) {
    return apiError(400, 'invalid_path', 'The upload could not be verified. Please try again.')
  }
  const { count } = await admin.from('requirement_attachments').select('id', { count: 'exact', head: true }).eq('storage_path', body.path)
  if ((count ?? 0) > 0) return apiError(409, 'already_confirmed', 'This file was already added.')

  const verified = await verifyUploadedObject(body.path, kind, { bucket: ATTACHMENT_BUCKET, maxBytes: MAX_ATTACHMENT_BYTES, sizeError: ATTACHMENT_SIZE_ERROR })
  if (!verified.ok) {
    await removeAttachmentObject(body.path)
    return apiError(400, 'invalid_upload', verified.reason, { fields: { file: [verified.reason] } })
  }

  const { data: att, error } = await admin
    .from('requirement_attachments')
    .insert({ org_id: req.org_id, requirement_id: id, uploaded_by: auth.userId, file_name: body.fileName, file_type: kind, file_size_bytes: verified.size, storage_path: body.path })
    .select('id, file_name, file_type, file_size_bytes, created_at')
    .single()
  if (error || !att) {
    await removeAttachmentObject(body.path)
    return apiError(500, 'confirm_failed', 'We could not save the file. Please try again.')
  }

  await logActivity({
    orgId: req.org_id,
    actorId: auth.userId,
    actorType: 'profile',
    entityType: 'requirement',
    entityId: id,
    action: 'requirement.attachment_added',
    description: `Attachment "${att.file_name}" added to "${req.title}"`,
    after: { file_name: att.file_name, file_type: att.file_type, file_size_bytes: att.file_size_bytes },
  })
  return NextResponse.json({ attachment: att }, { status: 201 })
})
