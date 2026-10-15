import type { Page } from '@playwright/test'

export class ContractPage {
  constructor(readonly page: Page) {}

  readonly table = () => this.page.getByRole('table', { name: 'Contracts' })
  readonly row = (title: string) => this.table().locator('tbody tr').filter({ hasText: title })
  readonly status = () => this.page.getByTestId('contract-status')
  readonly alertDays = () => this.page.getByTestId('alert-days')
  readonly alertDaysError = () => this.page.locator('#alert-days-error')
  readonly termination = () => this.page.getByTestId('termination')
  readonly terminateReasonError = () => this.page.locator('#terminate-reason-error')
  readonly activityList = () => this.page.getByRole('list', { name: 'Contract activity' })

  async gotoList(query = '') {
    await this.page.goto(`/contracts${query}`)
    await this.table().waitFor()
  }

  async gotoDetail(id: string) {
    await this.page.goto(`/contracts/${id}`)
    await this.status().waitFor()
  }

  async filter(tab: 'All' | 'Active' | 'Expiring Soon' | 'Expired' | 'Terminated') {
    await this.page.getByRole('navigation', { name: 'Filter by status' }).getByRole('link', { name: tab }).click()
  }

  async setAlertDays(days: string) {
    const input = this.page.getByLabel('Renewal alert threshold in days')
    if (!(await input.isVisible())) await this.alertDays().click()
    await input.fill(days)
    await this.page.getByRole('button', { name: 'Save', exact: true }).click()
  }

  async openTerminate() {
    await this.page.getByRole('button', { name: 'Mark as Terminated' }).click()
  }

  async confirmTerminate(reason?: string) {
    if (reason !== undefined) await this.page.locator('#terminate-reason').fill(reason)
    await this.page.getByRole('dialog').getByRole('button', { name: 'Mark as Terminated' }).click()
  }

  async initiateRenewal() {
    await this.page.getByRole('button', { name: 'Initiate Renewal' }).click()
    await this.page.getByRole('dialog').getByRole('button', { name: 'Create RFP' }).click()
  }
}
