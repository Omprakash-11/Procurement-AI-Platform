import { NextResponse } from 'next/server'

import { loadActivity } from '@/lib/activity-feed'
import { apiError, requireUser, withErrors } from '@/lib/api'

type Params = { params: Promise<{ id: string }> }

// GET /api/contracts/[id]/activity — App Flow §4 Contract Detail "Activity log: all actions taken
// on this contract", paged like /api/activity. PM only (contract read via RLS contracts_pm).
export const GET = withErrors(async function GET(request: Request, { params }: Params) {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response
  const { id } = await params
  const { data: contract } = await auth.supabase.from('contracts').select('id').eq('id', id).maybeSingle()
  if (!contract) return apiError(404, 'not_found', 'Contract not found.')
  const cursor = new URL(request.url).searchParams.get('cursor')
  return NextResponse.json(await loadActivity(auth.supabase, { contractId: id, role: 'procurement_manager', ...(cursor ? { cursor } : {}) }))
})
