import { NextResponse } from 'next/server'

import { loadActivity } from '@/lib/activity-feed'
import { apiError, requireUser } from '@/lib/api'

type Params = { params: Promise<{ id: string }> }

// GET /api/activity/rfp/[id] — Backend Schema §8.9: events scoped to one RFP and its vendors
// (PM, DH). The RFP must be readable (can_read_rfp); RLS P9-2 scopes the rows too.
export async function GET(request: Request, { params }: Params) {
  const auth = await requireUser(['procurement_manager', 'department_head'])
  if (!auth.ok) return auth.response
  const { id } = await params
  const { data: rfp } = await auth.supabase.from('rfps').select('id').eq('id', id).maybeSingle()
  if (!rfp) return apiError(404, 'not_found', 'RFP not found.')
  const cursor = new URL(request.url).searchParams.get('cursor')
  const role = auth.claims.role === 'vendor' ? undefined : auth.claims.role
  return NextResponse.json(await loadActivity(auth.supabase, { rfpId: id, ...(cursor ? { cursor } : {}), ...(role ? { role } : {}) }))
}
