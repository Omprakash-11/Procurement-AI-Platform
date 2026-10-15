import type { Page } from '@playwright/test'

export class ReportPage {
  constructor(readonly page: Page) {}

  readonly section = (name: string) => this.page.getByRole('heading', { name, exact: true })
  readonly recommendation = () => this.page.getByTestId('ai-recommendation')
  readonly pendingApproval = () => this.page.getByTestId('approval-pending')
  readonly submitButton = () => this.page.getByRole('button', { name: 'Submit for Approval' }).first()

  async goto(rfpId: string) {
    await this.page.goto(`/pipeline/rfp/${rfpId}/report`)
    await this.section('Executive Summary').waitFor()
  }

  /** P8-1 modal: vendor and approver are pre-selected when there is one obvious choice. */
  async submitForApproval() {
    await this.submitButton().click()
    await this.page.getByRole('dialog').getByRole('button', { name: 'Submit for Approval' }).click()
    await this.pendingApproval().waitFor()
  }

  async recall() {
    await this.page.getByRole('button', { name: 'Recall' }).click()
    await this.page.getByRole('button', { name: 'Recall Request' }).click()
  }
}
