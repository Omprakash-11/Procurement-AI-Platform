import type { Page } from '@playwright/test'

export class RequirementsPage {
  constructor(readonly page: Page) {}

  readonly table = () => this.page.getByRole('table', { name: 'Requirements' })
  readonly rows = () => this.table().locator('tbody tr')
  readonly row = (title: string) => this.rows().filter({ hasText: title })
  readonly fieldError = (field: string) => this.page.locator(`#req-${field}-error`)
  readonly fileError = () => this.page.locator('#req-file-error')
  readonly status = () => this.page.getByTestId('requirement-status')
  readonly toast = (text: string | RegExp) => this.page.locator('[data-sonner-toast]').filter({ hasText: text })

  async gotoList() {
    await this.page.goto('/requirements')
    await this.table().waitFor()
  }

  async gotoNew() {
    await this.page.goto('/requirements/new')
    await this.page.waitForFunction(() => {
      const input = document.querySelector<HTMLInputElement>('input[aria-label="Add attachments"]')
      return Boolean(input) && !input!.disabled
    })
  }

  async fill(v: { title: string; description: string; department?: string; budget?: string; requiredBy?: string }) {
    await this.page.locator('#req-title').fill(v.title)
    await this.page.locator('#req-description').fill(v.description)
    if (v.department) await this.page.locator('#req-department').fill(v.department)
    if (v.budget) await this.page.locator('#req-budget').fill(v.budget)
    if (v.requiredBy) await this.page.locator('#req-required-by').fill(v.requiredBy)
  }

  async attach(name: string, mimeType: string, buffer: Buffer) {
    await this.page.setInputFiles('input[aria-label="Add attachments"]', { name, mimeType, buffer })
  }

  async submit() {
    await this.page.getByRole('button', { name: 'Submit Requirement' }).click()
  }

  async saveDraft() {
    await this.page.getByRole('button', { name: 'Save as Draft' }).click()
  }
}
