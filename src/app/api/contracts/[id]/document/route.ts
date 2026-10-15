import { randomUUID } from 'node:crypto'

import { NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity'
import { apiError, requireUser, validationError } from '@/lib/api'
import { attachmentUploadSchema } from '@/lib/schemas/requirement'
import { MAX_UPLOAD_BYTES } from '@/lib/schemas/vendor-portal'
import { createAdminClient } from '@/lib/supabase/server'
import { mimeForExtension, safeFileName, typeFor, verifyUploadedObject } from '@/lib/vendor/storage'

type Params = { params: Promise<{ id: string }> }

const BUCKET = 'contract-documents'
const TYPE_ERROR = 'Only PDF, DOCX, and XLSX files are supported.'
const SIZE_ERROR = 'File exceeds the 50MB limit. Please compress or split the file.'

async function loadOwned(auth: Extract<Awaited<ReturnType<typeof requireUser>>, { ok: true }>, id: string) {
  // RLS contracts_pm: a PM of this org, contract not deleted.
  const { data } = await auth.supabase.from('contracts').select('id, org_id, title, status, document_path, rfp_id, vendor_account_id').eq('id', id).eq('is_deleted', false).maybeSingle()
  return data
}

// GET — download the contract file (App Flow §4 "Download"): 302 to a 60 s signed URL. The
// bucket has no storage policies; access is the RLS-checked contract read above.
export async function GET(_request: Request, { params }: Params) {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response
  const { id } = await params
  const contract = await loadOwned(auth, id)
  if (!contract?.document_path) return apiError(404, 'not_found', 'No contract file uploaded.')
  const name = contract.document_path.slice(contract.document_path.lastIndexOf('/') + 1).replace(/^[0-9a-f-]{36}-/, '')
  const { data: signed } = await createAdminClient().storage.from(BUCKET).createSignedUrl(contract.document_path, 60, { download: name })
  if (!signed?.signedUrl) return apiError(404, 'not_found', 'No contract file uploaded.')
  return NextResponse.redirect(signed.signedUrl, 302)
}

// POST — upload / replace the contract file (P9 defaults: contract-documents bucket at
// {org_id}/{contract_id}/…, Backend Schema §9). Same sign → upload → confirm steps as P6-1.
export async function POST(request: Request, { params }: Params) {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response
  const { id } = await params
  const contract = await loadOwned(auth, id)
  if (!contract) return apiError(404, 'not_found', 'Contract not found.')

  const parsed = attachmentUploadSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return validationError(parsed.error)
  const body = parsed.data
  const dir = `${contract.org_id}/${id}`
  const admin = createAdminClient()

  if (body.action === 'sign') {
    const kind = typeFor(body.fileName, body.mimeType)
    if (!kind) return apiError(400, 'unsupported_type', TYPE_ERROR, { fields: { file: [TYPE_ERROR] } })
    if (body.fileSize > MAX_UPLOAD_BYTES) return apiError(400, 'too_large', SIZE_ERROR, { fields: { file: [SIZE_ERROR] } })
    const path = `${dir}/${randomUUID()}-${safeFileName(body.fileName)}`
    const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path)
    if (error || !data) return apiError(500, 'sign_failed', 'We could not start the upload. Please try again.')
    return NextResponse.json({ path, signedUrl: data.signedUrl })
  }

  const kind = typeFor(body.fileName, mimeForExtension(body.fileName))
  const name = body.path.slice(dir.length + 1)
  const issuedShape = /^[0-9a-f-]{36}-/.test(name) && name.endsWith(`-${safeFileName(body.fileName)}`)
  if (!body.path.startsWith(`${dir}/`) || name.includes('/') || !kind || !issuedShape) {
    return apiError(400, 'invalid_path', 'The upload could not be verified. Please try again.')
  }
  const verified = await verifyUploadedObject(body.path, kind, { bucket: BUCKET, maxBytes: MAX_UPLOAD_BYTES, sizeError: SIZE_ERROR })
  if (!verified.ok) {
    await admin.storage.from(BUCKET).remove([body.path])
    return apiError(400, 'invalid_upload', verified.reason, { fields: { file: [verified.reason] } })
  }
  const { error } = await auth.supabase.from('contracts').update({ document_path: body.path }).eq('id', id)
  if (error) {
    await admin.storage.from(BUCKET).remove([body.path])
    return apiError(500, 'confirm_failed', 'We could not save the file. Please try again.')
  }
  if (contract.document_path && contract.document_path !== body.path) await admin.storage.from(BUCKET).remove([contract.document_path])

  await logActivity({
    orgId: contract.org_id, actorId: auth.userId, actorType: 'profile', entityType: 'contract', entityId: id,
    action: 'contract.document_uploaded', description: `Contract file "${body.fileName}" uploaded for "${contract.title}"`,
    before: { document: contract.document_path ? 'present' : null }, after: { document: body.fileName },
    metadata: { rfp_id: contract.rfp_id, vendor_account_id: contract.vendor_account_id, contract_id: id },
  })
  return NextResponse.json({ fileName: body.fileName }, { status: 201 })
}
