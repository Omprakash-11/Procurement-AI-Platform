import type { Page } from '@playwright/test'

export class ApprovalPage {
  constructor(readonly page: Page) {}

  readonly queue = () => this.page.getByRole('table', { name: /approval requests/ })
  readonly queueRow = (rfpTitle: string) => this.queue().locator('tbody tr').filter({ hasText: rfpTitle })
  readonly selectedVendor = () => this.page.getByTestId('approval-vendor')
  readonly escalations = () => this.page.getByRole('heading', { name: /Compliance escalations/ })
  readonly outcome = () => this.page.getByTestId('decision-outcome')
  readonly approveButton = () => this.page.getByRole('button', { name: 'Approve', exact: true }).first()
  readonly fieldError = (id: string) => this.page.locator(`#${id}-error`)

  async gotoQueue(all = false) {
    await this.page.goto(all ? '/approvals?view=all' : '/approvals')
    await this.queue().waitFor()
  }

  async gotoRequest(id: string) {
    await this.page.goto(`/approvals/${id}`)
    await this.selectedVendor().waitFor()
  }

  async approve(comment: string) {
    await this.approveButton().click()
    await this.page.locator('#decision-approved-comment').fill(comment)
    await this.page.getByRole('dialog').getByRole('button', { name: 'Approve' }).click()
    await this.outcome().waitFor()
  }

  async openReject() {
    await this.page.getByRole('button', { name: 'Reject', exact: true }).first().click()
  }

  async confirmReject() {
    await this.page.getByRole('dialog').getByRole('button', { name: 'Reject' }).click()
  }

  async reject(reason: string, comment: string) {
    await this.openReject()
    await this.page.locator('#decision-rejected-reason').click()
    await this.page.getByRole('option', { name: reason }).click()
    await this.page.locator('#decision-rejected-comment').fill(comment)
    await this.confirmReject()
    await this.outcome().waitFor()
  }
}
