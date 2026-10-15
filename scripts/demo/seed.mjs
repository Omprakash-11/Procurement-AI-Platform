// Demo organisation loader — command line (decisions P12-1, P12-3). Demonstration mode only:
// the platform itself never needs this data.
//
//   npm run demo:seed     → load "Northbridge Industries" into the local Supabase (once)
//   npm run demo:reset    → wipe that organisation (only it) and load it again
//   Production: node --env-file=.env.production.local scripts/demo/seed.mjs --reset --production
//   (the live demonstration also resets itself nightly through /api/cron/demo-reset — P12-8)
//
// Uses the service role. Creates accounts the supported way (admin API, role / org in
// app_metadata), uploads the demo documents and loads the AI results captured from real Gemini
// (scripts/demo/ai-results.json), so the demo is realistic, identical on every load and uses no
// AI quota.

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'

import { seedDemoOrganisation } from './demo-org.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const ACCOUNTS = JSON.parse(readFileSync(join(here, 'accounts.json'), 'utf8'))
const AI = JSON.parse(readFileSync(join(here, 'ai-results.json'), 'utf8'))
const FILES = Object.fromEntries(readdirSync(join(here, 'files')).map((name) => [name, readFileSync(join(here, 'files', name))]))
const args = new Set(process.argv.slice(2))

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !SERVICE) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (use --env-file).')
const isLocal = /^http:\/\/(127\.0\.0\.1|localhost)/.test(URL_)
if (!isLocal && !args.has('--production')) throw new Error('Refusing to touch a hosted Supabase project without --production.')

async function main() {
  const client = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
  const result = await seedDemoOrganisation({ client, accounts: ACCOUNTS, aiResults: AI, files: FILES, reset: args.has('--reset') })
  if (result.skipped) {
    console.log('The demo organisation already exists. Run `npm run demo:reset` to reload it.')
    return
  }
  console.log(`Loaded "${ACCOUNTS.organisation}" (${result.rfps} RFPs, ${result.activity} activity entries) into ${isLocal ? 'the local' : 'the hosted'} Supabase.`)
  console.log(`Sign in with any demo account — password: ${ACCOUNTS.password}`)
  for (const a of [...ACCOUNTS.internal, ...ACCOUNTS.vendors]) console.log(`  ${a.label.padEnd(36)} ${a.email}`)
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})
