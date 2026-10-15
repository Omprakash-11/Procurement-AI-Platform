import type { Page } from '@playwright/test'

export class DashboardPage {
  constructor(readonly page: Page) {}

  readonly heading = () => this.page.getByRole('heading', { name: 'Dashboard', level: 1 })
  readonly statValue = (testId: string) => this.page.getByTestId(`${testId}-value`)
  readonly sidebarLink = (name: string) => this.page.getByRole('navigation').getByRole('link', { name, exact: true })
  readonly toast = (text: string | RegExp) => this.page.locator('[data-sonner-toast]').filter({ hasText: text })
  readonly notificationCount = () => this.page.getByTestId('notification-count')
  readonly renewalTable = () => this.page.getByRole('table', { name: 'Contracts inside their renewal alert window' })

  async goto() {
    await this.page.goto('/dashboard')
    await this.heading().waitFor()
  }

  async signOut() {
    await this.page.getByRole('button', { name: 'Account menu' }).click()
    await this.page.getByRole('menuitem', { name: 'Sign Out' }).click()
  }

  async openNotification(title: string | RegExp) {
    await this.page.getByRole('button', { name: /Notifications, \d+ unread/ }).click()
    await this.page.getByRole('list', { name: 'Unread notifications' }).getByText(title).first().click()
  }
}
