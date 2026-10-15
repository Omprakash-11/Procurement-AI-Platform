import { NextResponse } from 'next/server'

import { INTERNAL_ROLES, requireUser, withErrors } from '@/lib/api'
import { runSearch } from '@/lib/search'
import type { UserRole } from '@/types'

// GET /api/search?q= — Backend Schema §8.9 / decision P10-1: full-text search across RFPs,
// vendors and contracts (tsvector, RLS-scoped). Internal users only. ?limit= up to 50
// (the overlay asks for 5 per category).
export const GET = withErrors(async function GET(request: Request) {
  const auth = await requireUser(INTERNAL_ROLES)
  if (!auth.ok) return auth.response
  const p = new URL(request.url).searchParams
  const q = (p.get('q') ?? '').slice(0, 100)
  const limit = Math.min(Math.max(Number(p.get('limit')) || 5, 1), 50)
  // requireUser(INTERNAL_ROLES) guarantees an internal role here.
  return NextResponse.json(await runSearch(auth.supabase, q, auth.claims.role as UserRole, limit))
})
