import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { NextResponse } from 'next/server'

import accounts from '../../../../../scripts/demo/accounts.json'
import aiResults from '../../../../../scripts/demo/ai-results.json'
import { seedDemoOrganisation } from '../../../../../scripts/demo/demo-org.mjs'
import { apiError, withErrors } from '@/lib/api'
import { cronUnauthorized } from '@/lib/cron'
import { isDemoMode } from '@/lib/demo'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Decision P12-8: a demonstration deployment (DEMO_MODE=1) restores the shared demo organisation
// every night (vercel.json), so each visitor starts from the same state. Only the demo
// organisation is touched (seedDemoOrganisation's safety check); without DEMO_MODE the route
// doesn't exist. The demo documents ship with this function (outputFileTracingIncludes).
async function run(request: Request) {
  const denied = cronUnauthorized(request)
  if (denied) return denied
  if (!isDemoMode()) return apiError(404, 'not_found', 'Not found.')

  const dir = join(process.cwd(), 'scripts', 'demo', 'files')
  const files = Object.fromEntries(readdirSync(dir).map((name) => [name, readFileSync(join(dir, name))]))
  const result = await seedDemoOrganisation({ client: createAdminClient(), accounts, aiResults, files, reset: true })
  return NextResponse.json({ reset: true, ...result })
}

export const GET = withErrors(run)
export const POST = withErrors(run)
