import type { Page } from '@playwright/test'

const UPLOAD_INPUT = 'input[aria-label="Upload proposal documents"]'

export class VendorPortalPage {
  constructor(readonly page: Page) {}

  readonly myRfps = () => this.page.getByRole('table', { name: 'My RFPs' })
  readonly myRfpRow = (title: string) => this.myRfps().locator('tbody tr').filter({ hasText: title })
  readonly documentList = () => this.page.getByTestId('document-list')
  readonly uploaded = (fileName: string) => this.documentList().locator('li').filter({ hasText: fileName }).filter({ hasText: 'Uploaded' })
  readonly uploadError = () => this.page.locator('#upload-error')
  readonly submitButton = () => this.page.getByRole('button', { name: 'Submit Proposal' }).first()
  readonly submittedMessage = () => this.page.getByTestId('submitted-message')
  readonly status = () => this.page.getByTestId('vendor-status')
  readonly banner = () => this.page.getByTestId('vendor-banner')

  async acceptNewInvite(token: string, v: { fullName: string; password: string }) {
    await this.page.goto(`/vendor/invite/${token}`)
    await this.page.locator('#vendor-fullName').fill(v.fullName)
    await this.page.locator('#vendor-password').fill(v.password)
    await this.page.locator('#vendor-confirmPassword').fill(v.password)
    await this.page.getByRole('button', { name: /Accept Invite/ }).click()
  }

  async acceptAsExistingVendor(token: string, password: string) {
    await this.page.goto(`/vendor/invite/${token}`)
    await this.page.locator('#vendor-login-password').fill(password)
    await this.page.getByRole('button', { name: /Accept Invite/ }).click()
  }

  async gotoHome() {
    await this.page.goto('/vendor')
    await this.myRfps().waitFor()
  }

  async gotoRfp(rfpId: string) {
    await this.page.goto(`/vendor/rfp/${rfpId}`)
    // File pickers stay disabled until the page is hydrated (Phase 10) — like a real user, wait.
    await this.page.waitForFunction((sel) => {
      const input = document.querySelector<HTMLInputElement>(sel)
      return Boolean(input) && !input!.disabled
    }, UPLOAD_INPUT)
  }

  async upload(name: string, mimeType: string, buffer: Buffer) {
    await this.page.setInputFiles(UPLOAD_INPUT, { name, mimeType, buffer })
  }

  async submit() {
    await this.submitButton().click()
    await this.page.getByRole('button', { name: 'Submit Proposal' }).last().click()
  }
}
