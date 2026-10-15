import type { Page } from '@playwright/test'

export class ActivityPage {
  constructor(readonly page: Page) {}

  readonly list = () => this.page.getByTestId('activity-list')
  readonly entries = () => this.list().locator('li')
  readonly entry = (text: string | RegExp) => this.entries().filter({ hasText: text })
  readonly empty = () => this.page.getByTestId('activity-empty')
  readonly changes = () => this.page.getByTestId('activity-changes')

  async goto() {
    await this.page.goto('/activity')
    await this.list().waitFor()
  }

  async filterType(label: string) {
    await this.page.locator('#activity-type').click()
    await this.page.getByRole('option', { name: label }).click()
  }

  async filterFrom(date: string) {
    await this.page.locator('#activity-from').fill(date)
  }

  async expandChanges(entryText: string | RegExp) {
    await this.entry(entryText).first().getByRole('button', { name: /change/ }).click()
  }
}
