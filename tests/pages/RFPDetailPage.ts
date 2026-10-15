import type { Page } from '@playwright/test'

export class RFPDetailPage {
  constructor(readonly page: Page) {}

  readonly status = () => this.page.getByTestId('rfp-status')
  readonly vendorTable = () => this.page.getByRole('table', { name: 'Vendors invited to this RFP' })
  readonly vendorRow = (text: string) => this.vendorTable().locator('tbody tr').filter({ hasText: text })
  readonly inviteEmailError = () => this.page.locator('#invite-vendor-email-error')
  readonly inviteEmail = () => this.page.locator('#invite-vendor-email')
  readonly startEvaluationButton = () => this.page.getByRole('button', { name: 'Start Evaluation' })
  readonly scoringInProgress = () => this.page.getByRole('button', { name: 'Scoring in progress…' })
  readonly generateReportButton = () => this.page.getByRole('button', { name: /Generate Report|Regenerate Report/ })
  readonly criteriaList = () => this.page.getByRole('list', { name: 'Scoring criteria' })
  readonly criteriaTotal = () => this.page.getByTestId('criteria-total')
  readonly confirmScoring = () => this.page.getByRole('button', { name: 'Confirm and Start Scoring' })
  readonly activityList = () => this.page.getByRole('list', { name: 'RFP activity' })
  readonly toast = (text: string | RegExp) => this.page.locator('[data-sonner-toast]').filter({ hasText: text })

  async goto(rfpId: string) {
    await this.page.goto(`/pipeline/rfp/${rfpId}`)
    await this.status().waitFor()
  }

  async inviteVendor(email: string, company: string, message = '') {
    await this.page.getByRole('button', { name: 'Invite Vendor', exact: true }).click()
    await this.inviteEmail().fill(email)
    await this.page.locator('#invite-vendor-company').fill(company)
    if (message) await this.page.locator('#invite-vendor-message').fill(message)
    await this.page.getByRole('button', { name: 'Send Invite' }).click()
  }

  async toggleShortlist(company: string) {
    await this.vendorRow(company).getByRole('button', { name: new RegExp(`^(Shortlist ${company}|Remove ${company} from shortlist)$`) }).click()
  }

  async openCriteriaModal() {
    await this.startEvaluationButton().click()
    await this.page.getByRole('heading', { name: 'Review AI-Suggested Scoring Criteria' }).waitFor()
  }

  async setCriterionWeight(index: number, weight: string) {
    await this.page.getByLabel(`Criterion ${index} weight`).fill(weight)
  }

  async criterionWeight(index: number) {
    return this.page.getByLabel(`Criterion ${index} weight`).inputValue()
  }

  async openActivityTab() {
    await this.page.getByRole('tab', { name: 'Activity' }).click()
  }
}
