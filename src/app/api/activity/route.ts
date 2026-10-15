import { NextResponse } from 'next/server'

import { EVENT_GROUPS, loadActivity, type EventGroup } from '@/lib/activity-feed'
import { INTERNAL_ROLES, requireUser, withErrors } from '@/lib/api'

// GET /api/activity — Backend Schema §8.9: paginated activity for the org, 50 per page
// (?cursor=<created_at> for the next page; ?type=<group>, ?from / ?to dates). All internal
// roles; RLS (P9-2) scopes DH and FA. Optional ?rfpId (&vendorAccountId) narrows to one RFP /
// one vendor within it (App Flow §8.2 per-vendor section).
export const GET = withErrors(async function GET(request: Request) {
  const auth = await requireUser(INTERNAL_ROLES)
  if (!auth.ok) return auth.response
  const p = new URL(request.url).searchParams
  const type = p.get('type')
  const role = auth.claims.role === 'vendor' ? undefined : auth.claims.role
  const result = await loadActivity(auth.supabase, {
    ...(type && type in EVENT_GROUPS ? { group: type as EventGroup } : {}),
    ...(p.get('from') ? { from: p.get('from')! } : {}),
    ...(p.get('to') ? { to: p.get('to')! } : {}),
    ...(p.get('cursor') ? { cursor: p.get('cursor')! } : {}),
    ...(p.get('rfpId') ? { rfpId: p.get('rfpId')! } : {}),
    ...(p.get('vendorAccountId') ? { vendorAccountId: p.get('vendorAccountId')! } : {}),
    ...(role ? { role } : {}),
  })
  return NextResponse.json(result)
})
