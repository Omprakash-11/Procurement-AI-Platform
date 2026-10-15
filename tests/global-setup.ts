import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { db } from './helpers/db'
import { clearMail } from './helpers/mail'

// Decision P11-2: one `supabase db reset` (migrations + seed) before the whole run; specs then
// create their own uniquely named data, so they don't depend on one another.
export default async function globalSetup() {
  if (!existsSync(join(process.cwd(), '.next', 'BUILD_ID'))) {
    throw new Error('No production build found — run `npm run build` before `npx playwright test`.')
  }
  // Fixed command, no user input; `shell` lets Windows resolve the CLI shim. The CLI reports
  // progress (and "Finished …") on stderr.
  const run = spawnSync('supabase', ['db', 'reset'], { encoding: 'utf8', shell: true })
  const out = `${run.stdout ?? ''}${run.stderr ?? ''}`
  if (!/Finished supabase db reset/.test(out)) throw new Error(`supabase db reset did not finish:\n${out.slice(-800)}`)

  // The API restarts after a reset; wait until the seed data answers.
  const end = Date.now() + 60_000
  for (;;) {
    const { count, error } = await db().from('profiles').select('id', { count: 'exact', head: true })
    if (!error && (count ?? 0) >= 3) break
    if (Date.now() > end) throw new Error('Local Supabase did not come back after the reset.')
    await new Promise((r) => setTimeout(r, 1000))
  }
  await clearMail()
}
