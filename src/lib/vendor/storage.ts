import { createAdminClient } from '@/lib/supabase/server'

import { ACCEPTED_TYPES, MAX_UPLOAD_BYTES, type AcceptedMime } from '@/lib/schemas/vendor-portal'

export const VENDOR_BUCKET = 'vendor-documents'

/** Backend Schema §9 path: {org_id}/{rfp_id}/{vendor_id}/{filename} — filename made unique and safe. */
export function vendorDocumentDir(orgId: string, rfpId: string, vendorAccountId: string) {
  return `${orgId}/${rfpId}/${vendorAccountId}`
}

export function safeFileName(name: string): string {
  const cleaned = name.normalize('NFKD').replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '-').slice(-120)
  return cleaned || 'document'
}

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot).toLowerCase() : ''
}

export { mimeForExtension } from '@/lib/vendor/mime'

/** The extension must agree with the declared MIME type (Tech Stack §6.1 accepted types). */
export function typeFor(fileName: string, mime: string): (typeof ACCEPTED_TYPES)[AcceptedMime] | null {
  const kind = ACCEPTED_TYPES[mime as AcceptedMime]
  if (!kind) return null
  return extensionOf(fileName) === `.${kind}` ? kind : null
}

// Decision P6-1 confirm step: the object must exist, be within the size limit, and start with
// the right file signature (PDF: "%PDF-"; DOCX / XLSX are ZIP containers: "PK\x03\x04").
// Also used for requirement attachments (P8-4) with their own bucket and 20MB limit.
type VerifyOptions = { bucket?: string; maxBytes?: number; sizeError?: string }

export async function verifyUploadedObject(
  path: string,
  kind: 'pdf' | 'docx' | 'xlsx',
  { bucket = VENDOR_BUCKET, maxBytes = MAX_UPLOAD_BYTES, sizeError = 'File exceeds the 50MB limit. Please compress or split the file.' }: VerifyOptions = {}
): Promise<{ ok: true; size: number } | { ok: false; reason: string }> {
  const admin = createAdminClient()
  const dir = path.slice(0, path.lastIndexOf('/'))
  const name = path.slice(path.lastIndexOf('/') + 1)
  const { data: listing } = await admin.storage.from(bucket).list(dir, { search: name, limit: 5 })
  const object = listing?.find((o) => o.name === name)
  if (!object) return { ok: false, reason: 'The upload did not complete. Please try again.' }
  const size = Number((object.metadata as { size?: number } | null)?.size ?? 0)
  if (!size || size > maxBytes) return { ok: false, reason: sizeError }

  const { data: signed } = await admin.storage.from(bucket).createSignedUrl(path, 60)
  if (!signed?.signedUrl) return { ok: false, reason: 'The upload could not be verified. Please try again.' }
  const res = await fetch(signed.signedUrl, { headers: { Range: 'bytes=0-7' } })
  const head = Buffer.from(await res.arrayBuffer()).subarray(0, 8)
  const isPdf = head.subarray(0, 5).toString('latin1') === '%PDF-'
  const isZip = head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04
  const ok = kind === 'pdf' ? isPdf : isZip
  return ok ? { ok: true, size } : { ok: false, reason: 'Only PDF, DOCX, and XLSX files are supported.' }
}

export async function removeObject(path: string) {
  await createAdminClient().storage.from(VENDOR_BUCKET).remove([path])
}
