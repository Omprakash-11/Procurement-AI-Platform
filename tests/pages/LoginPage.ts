import type { Page } from '@playwright/test'

export class LoginPage {
  constructor(readonly page: Page) {}

  readonly email = () => this.page.locator('#email')
  readonly password = () => this.page.locator('#password')
  readonly submit = () => this.page.getByRole('button', { name: 'Sign In' })
  readonly passwordError = () => this.page.locator('#password-error')
  readonly formError = () => this.page.getByRole('alert').first()
  readonly forgotPassword = () => this.page.getByRole('button', { name: 'Forgot password?' })
  readonly toast = (text: string | RegExp) => this.page.locator('[data-sonner-toast]').filter({ hasText: text })

  async goto(query = '') {
    await this.page.goto(`/login${query}`)
  }

  async signIn(email: string, password: string) {
    await this.email().fill(email)
    await this.password().fill(password)
    await this.submit().click()
  }

  async requestReset(email: string) {
    await this.forgotPassword().click()
    await this.page.locator('#reset-email').fill(email)
    await this.page.getByRole('button', { name: 'Send Reset Link' }).click()
  }
}
