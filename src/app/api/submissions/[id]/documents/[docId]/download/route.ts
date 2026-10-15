import { NextResponse } from 'next/server'

import { apiError, requireUser, withErrors } from '@/lib/api'
import { VENDOR_BUCKET } from '@/lib/vendor/storage'

type Params = { params: Promise<{ id: string; docId: string }> }

// GET /api/submissions/[id]/documents/[docId]/download — App Flow §4 Documents tab "Download"
// (no inline viewer). Not in Backend Schema §8. The signed URL is made with the PM's own client,
// so the storage policy (submitted documents of the PM's org, P7-4) is enforced. 60 s validity.
export const GET = withErrors(async function GET(_request: Request, { params }: Params) {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response
  const { id, docId } = await params
  const { data: doc } = await auth.supabase.from('documents').select('file_name, storage_path').eq('id', docId).eq('submission_id', id).maybeSingle()
  if (!doc) return apiError(404, 'not_found', 'Document not found.')
  const { data: signed } = await auth.supabase.storage.from(VENDOR_BUCKET).createSignedUrl(doc.storage_path, 60, { download: doc.file_name })
  if (!signed?.signedUrl) return apiError(404, 'not_found', 'Document not found.')
  return NextResponse.redirect(signed.signedUrl, 302)
})
