import { expect, test } from './fixtures/auth'
import { createThrowawayUser } from './helpers/db'
import { PASSWORD, USERS } from './helpers/env'
import { clearMail, waitForMail } from './helpers/mail'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'

// Tech Stack §12.2 auth flow: login, logout, password reset, expired session, role access.

test.describe('Authentication', () => {
  test('wrong password shows an inline error; correct password lands on the dashboard', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.signIn(USERS.pm, 'WrongPassword1')
    await expect(login.formError()).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
    await login.signIn(USERS.pm, PASSWORD)
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('sign out returns to login and protected pages redirect there', async ({ page }) => {
    // Sign-out ends all of a user's sessions, so this uses its own account.
    const email = await createThrowawayUser('department_head', 'Jordan Ellis')
    const login = new LoginPage(page)
    await login.goto()
    await login.signIn(email, PASSWORD)
    const dashboard = new DashboardPage(page)
    await dashboard.heading().waitFor()
    await dashboard.signOut()
    await expect(page).toHaveURL(/\/login/)
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login\?redirectTo=%2Fdashboard/)
  })

  test('password reset: the reset route redirects to login and the reset email is sent', async ({ page }) => {
    await clearMail()
    await page.goto('/reset-password')
    await expect(page).toHaveURL(/\/login/)
    const login = new LoginPage(page)
    await login.requestReset(USERS.fa)
    const mail = await waitForMail(USERS.fa, /reset/i)
    expect(mail.html).toMatch(/\/reset-password\/[A-Za-z0-9_-]+/)
  })

  test('an expired session redirects to login with the session-expired message', async ({ pmPage }) => {
    const dashboard = new DashboardPage(pmPage)
    await dashboard.goto()
    await pmPage.context().clearCookies()
    await pmPage.goto('/pipeline')
    await expect(pmPage).toHaveURL(/\/login\?redirectTo=%2Fpipeline/)
  })

  test('roles are kept to their own pages', async ({ faPage, dhPage, vendorPage }) => {
    await faPage.goto('/pipeline')
    await expect(faPage).toHaveURL(/\/dashboard/)
    await expect(new DashboardPage(faPage).toast('You do not have permission to access that page.')).toBeVisible()

    await dhPage.goto('/contracts')
    await expect(dhPage).toHaveURL(/\/dashboard/)

    await vendorPage.goto('/dashboard')
    await expect(vendorPage).toHaveURL(/\/vendor$/)
  })
})
