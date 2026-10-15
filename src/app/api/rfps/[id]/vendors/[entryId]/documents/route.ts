import { NextResponse } from 'next/server'

import { apiError, requireUser } from '@/lib/api'
import { loadVendorDocuments } from '@/lib/vendor-detail'

type Params = { params: Promise<{ id: string; entryId: string }> }

// GET /api/rfps/[id]/vendors/[entryId]/documents — not in Backend Schema §8; added for the
// Vendor Detail Documents / Compliance tabs (App Flow §4), polled every 5 s while processing.
// PM only; RLS hides documents the vendor hasn't submitted yet (P7-4).
export async function GET(_request: Request, { params }: Params) {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response
  const { id, entryId } = await params
  const { data: entry } = await auth.supabase.from('rfp_vendor_entries').select('vendor_account_id').eq('id', entryId).eq('rfp_id', id).maybeSingle()
  if (!entry) return apiError(404, 'not_found', 'Vendor not found.')
  return NextResponse.json(await loadVendorDocuments(auth.supabase, id, entry.vendor_account_id))
}
