import { timingSafeEqual } from 'node:crypto'

import { apiError } from '@/lib/api'

// Decision P9-1: Vercel Cron calls with GET and "Authorization: Bearer <CRON_SECRET>"; manual
// runs may POST with the same header. Constant-time comparison; no secret configured = refuse.
export function cronUnauthorized(request: Request): Response | null {
  const secret = process.env.CRON_SECRET
  const header = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret ?? ''}`
  const ok = Boolean(secret) && header.length === expected.length && timingSafeEqual(Buffer.from(header), Buffer.from(expected))
  return ok ? null : apiError(401, 'unauthorized', 'Unauthorized.')
}
