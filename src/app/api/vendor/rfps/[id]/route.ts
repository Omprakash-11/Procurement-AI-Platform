import { NextResponse } from 'next/server'

import { apiError, withErrors } from '@/lib/api'
import { getVendorRfp, requireVendor, toClientRfp } from '@/lib/vendor/portal'

type Params = { params: Promise<{ id: string }> }

// GET /api/vendor/rfps/[id] — the vendor's view of one RFP, polled every 30 s for status
// (P6 default). Whitelisted fields only (P2-4). Not in Backend Schema §8 (vendor RFP data
// can't come from RLS reads — P2-4).
export const GET = withErrors(async function GET(_request: Request, { params }: Params) {
  const auth = await requireVendor()
  if (!auth.ok) return auth.response
  const { id } = await params
  const rfp = await getVendorRfp(auth.userId, id)
  if (!rfp) return apiError(404, 'not_found', 'RFP not found.')
  return NextResponse.json({ rfp: toClientRfp(rfp) })
})
