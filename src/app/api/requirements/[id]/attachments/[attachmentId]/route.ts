import { NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity'
import { apiError, requireUser } from '@/lib/api'
import { ATTACHMENT_BUCKET, removeAttachmentObject } from '@/lib/requirement-files'
import { createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string; attachmentId: string }> }

// GET — download (302 to a 60 s signed URL). The row is read with the caller's client, so RLS
// (requirement_attachments_read: PM, or the DH who raised it) is the access check; the bucket
// itself has no policies, so the URL is signed with the service role afterwards.
export async function GET(_request: Request, { params }: Params) {
  const auth = await requireUser(['procurement_manager', 'department_head'])
  if (!auth.ok) return auth.response
  const { id, attachmentId } = await params
  const { data: att } = await auth.supabase.from('requirement_attachments').select('file_name, storage_path').eq('id', attachmentId).eq('requirement_id', id).maybeSingle()
  if (!att) return apiError(404, 'not_found', 'Attachment not found.')
  const { data: signed } = await createAdminClient().storage.from(ATTACHMENT_BUCKET).createSignedUrl(att.storage_path, 60, { download: att.file_name })
  if (!signed?.signedUrl) return apiError(404, 'not_found', 'Attachment not found.')
  return NextResponse.redirect(signed.signedUrl, 302)
}

// DELETE — the raising DH removes an attachment while the requirement is still editable.
export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireUser(['department_head'])
  if (!auth.ok) return auth.response
  const { id, attachmentId } = await params
  const { data: req } = await auth.supabase.from('requirements').select('org_id, title, status, raised_by, linked_rfp_id').eq('id', id).eq('is_deleted', false).maybeSingle()
  if (!req || req.raised_by !== auth.userId) return apiError(404, 'not_found', 'Attachment not found.')
  if (!['draft', 'submitted'].includes(req.status) || req.linked_rfp_id) return apiError(409, 'locked', 'This requirement can no longer be changed.')

  const admin = createAdminClient()
  const { data: att } = await admin.from('requirement_attachments').select('id, file_name, storage_path').eq('id', attachmentId).eq('requirement_id', id).maybeSingle()
  if (!att) return apiError(404, 'not_found', 'Attachment not found.')
  await removeAttachmentObject(att.storage_path)
  await admin.from('requirement_attachments').delete().eq('id', attachmentId)

  await logActivity({
    orgId: req.org_id,
    actorId: auth.userId,
    actorType: 'profile',
    entityType: 'requirement',
    entityId: id,
    action: 'requirement.attachment_removed',
    description: `Attachment "${att.file_name}" removed from "${req.title}"`,
    before: { file_name: att.file_name },
  })
  return NextResponse.json({ status: 'removed' })
}
