import { createClient } from '@supabase/supabase-js'

import { expect, test } from './fixtures/auth'
import { createReportedRfp } from './helpers/db'
import { env, PASSWORD, SEED, unique, USERS } from './helpers/env'

// Vendor isolation (CLAUDE.md, decision P11-3): vendors never see scores, compliance flags,
// reports, internal notes or other vendors — not in pages, API responses or direct DB access.

test.describe('Vendor isolation', () => {
  test('internal pages redirect a vendor to the portal', async ({ vendorPage }) => {
    for (const path of ['/dashboard', '/pipeline', `/pipeline/rfp/${SEED.rfpId}/report`, '/contracts', '/activity']) {
      await vendorPage.goto(path)
      await expect(vendorPage).toHaveURL(/\/vendor$/)
    }
  })

  test('internal APIs refuse a vendor', async ({ vendorPage }) => {
    const { rfpId } = await createReportedRfp(unique('Isolation check'))
    for (const path of ['/api/rfps', `/api/evaluations/${rfpId}`, `/api/reports/${rfpId}`, '/api/approvals', '/api/contracts', '/api/activity', '/api/search?q=cloud', `/api/reports/${rfpId}/comments`]) {
      const res = await vendorPage.request.get(path)
      expect(res.status(), path).toBe(403)
      expect(await res.json()).toMatchObject({ error: expect.any(String), code: expect.any(String) })
    }
  })

  test('direct database access returns nothing internal to a vendor', async () => {
    await createReportedRfp(unique('Isolation DB check'))
    const client = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('NEXT_PUBLIC_SUPABASE_ANON_KEY'), { auth: { persistSession: false } })
    const { error } = await client.auth.signInWithPassword({ email: USERS.vendor1, password: PASSWORD })
    expect(error).toBeNull()
    for (const table of ['evaluations', 'evaluation_criteria', 'vendor_scores', 'compliance_flags', 'vendor_notes', 'report_comments', 'approval_requests', 'contracts', 'requirements', 'activity_log'] as const) {
      const { data } = await client.from(table).select('id')
      expect(data ?? [], table).toHaveLength(0)
    }
    await client.auth.signOut({ scope: 'local' })
  })

  test("the vendor's own RFP view carries no internal fields", async ({ vendorPage }) => {
    const { rfpId } = await createReportedRfp(unique('Isolation view check'))
    const res = await vendorPage.request.get(`/api/vendor/rfps/${rfpId}`)
    expect(res.status()).toBe(200)
    expect(JSON.stringify(await res.json())).not.toMatch(/score|flag|extract|raw_|recommend|summary|budget/i)
  })
})
