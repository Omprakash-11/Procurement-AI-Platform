import type { Page } from '@playwright/test'

export class VendorDetailPage {
  constructor(readonly page: Page) {}

  readonly documentRow = (fileName: string) => this.page.getByRole('table', { name: 'Submitted documents' }).locator('tbody tr').filter({ hasText: fileName })
  readonly failedBanner = () => this.page.getByRole('alert').filter({ hasText: 'Extraction failed.' })
  readonly extractedPanel = () => this.page.getByText('AI Extracted')
  readonly scoresTable = () => this.page.getByRole('table', { name: 'Scores by criterion' })
  readonly vendorTotal = () => this.page.getByTestId('vendor-total')
  readonly flagsTable = () => this.page.getByRole('table', { name: 'Compliance flags' })
  readonly flagCount = (severity: 'high' | 'medium' | 'low') => this.page.getByTestId(`flag-count-${severity}`)
  readonly activityList = () => this.page.getByRole('list', { name: 'Vendor activity' })

  async goto(rfpId: string, vendorAccountId: string) {
    await this.page.goto(`/pipeline/rfp/${rfpId}/vendor/${vendorAccountId}`)
    await this.page.getByRole('tab', { name: 'Documents' }).waitFor()
  }

  async tab(name: 'Documents' | 'Scores' | 'Compliance' | 'Notes') {
    await this.page.getByRole('tab', { name }).click()
  }

  async viewExtractedData() {
    await this.page.getByRole('button', { name: 'View Extracted Data' }).first().click()
  }
}
