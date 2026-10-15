import { waitUntil } from '@vercel/functions'
import { NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity'
import { apiError, requireUser, withErrors } from '@/lib/api'
import { claimDocument, processDocument, STALE_PROCESSING_MS } from '@/lib/processing/documents'

export const maxDuration = 300 // decision P7-2

type Params = { params: Promise<{ id: string }> }

// POST /api/process/document/[id] — Backend Schema §8.4. Decision P7-2: the automatic run is
// started in-process by the submit route; this route is the PM's Retry (failed documents, or
// ones left queued / processing by a killed function).
export const POST = withErrors(async function POST(_request: Request, { params }: Params) {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response
  const { id } = await params

  // RLS (documents_internal_read, P7-4): only submitted documents of the PM's org are visible.
  const { data: doc } = await auth.supabase
    .from('documents')
    .select('id, org_id, file_name, extraction_status, updated_at, submissions!inner(rfp_id, vendor_account_id)')
    .eq('id', id)
    .maybeSingle()
  if (!doc) return apiError(404, 'not_found', 'Document not found.')
  const idle = Date.now() - new Date(doc.updated_at).getTime() > STALE_PROCESSING_MS
  if (doc.extraction_status === 'extracted') return apiError(409, 'already_extracted', 'This document has already been processed.')
  if (doc.extraction_status !== 'failed' && !idle) return apiError(409, 'in_progress', 'This document is already being processed.')

  // Claim now (→ processing) so the next poll already shows progress; a parallel retry loses.
  if (!(await claimDocument(id))) return apiError(409, 'in_progress', 'This document is already being processed.')
  await logActivity({
    orgId: doc.org_id,
    actorId: auth.userId,
    actorType: 'profile',
    entityType: 'document',
    entityId: id,
    action: 'document.retry',
    description: `Extraction retried for "${doc.file_name}"`,
    before: { extraction_status: doc.extraction_status },
    metadata: { rfp_id: doc.submissions.rfp_id, vendor_account_id: doc.submissions.vendor_account_id },
  })
  waitUntil(processDocument(id, true))
  return NextResponse.json({ status: 'processing' }, { status: 202 })
})
