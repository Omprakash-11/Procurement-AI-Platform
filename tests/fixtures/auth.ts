import { test as base, type Browser, type Page } from '@playwright/test'
import { createServerClient } from '@supabase/ssr'

import { env, PASSWORD, USERS, type Role } from '../helpers/env'

// Plan Phase 11 auth fixtures: a page already signed in as each role. Each test gets a fresh
// session — signed in through the Supabase API and handed to the browser as the same cookies
// the app sets — so sign-out tests (which end all of a user's sessions) can't break other tests.

export async function sessionCookies(email: string) {
  const jar: { name: string; value: string }[] = []
  const supabase = createServerClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
    cookies: { getAll: () => jar, setAll: (cookies) => cookies.forEach(({ name, value }) => jar.push({ name, value })) },
  })
  const { error } = await supabase.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`)
  return jar
}

export async function pageAs(browser: Browser, role: Role, baseURL: string): Promise<Page> {
  const context = await browser.newContext({ baseURL, acceptDownloads: true })
  const cookies = await sessionCookies(USERS[role])
  await context.addCookies(cookies.map((c) => ({ ...c, domain: 'localhost', path: '/', sameSite: 'Lax' as const })))
  return context.newPage()
}

type RoleFixtures = { pmPage: Page; dhPage: Page; faPage: Page; vendorPage: Page; vendor2Page: Page }

export const test = base.extend<RoleFixtures>({
  pmPage: async ({ browser, baseURL }, use) => {
    const page = await pageAs(browser, 'pm', baseURL!)
    await use(page)
    await page.context().close()
  },
  dhPage: async ({ browser, baseURL }, use) => {
    const page = await pageAs(browser, 'dh', baseURL!)
    await use(page)
    await page.context().close()
  },
  faPage: async ({ browser, baseURL }, use) => {
    const page = await pageAs(browser, 'fa', baseURL!)
    await use(page)
    await page.context().close()
  },
  vendorPage: async ({ browser, baseURL }, use) => {
    const page = await pageAs(browser, 'vendor1', baseURL!)
    await use(page)
    await page.context().close()
  },
  vendor2Page: async ({ browser, baseURL }, use) => {
    const page = await pageAs(browser, 'vendor2', baseURL!)
    await use(page)
    await page.context().close()
  },
})

export { expect } from '@playwright/test'
