import type { Page } from '@playwright/test'

export class PipelinePage {
  constructor(readonly page: Page) {}

  readonly board = () => this.page.getByRole('region', { name: 'Pipeline board' })
  readonly column = (status: string) => this.page.getByTestId(`column-${status}`)
  readonly count = (status: string) => this.page.getByTestId(`count-${status}`)
  readonly card = (rfpId: string) => this.page.getByTestId(`rfp-card-${rfpId}`)
  readonly requirementCard = (requirementId: string) => this.page.getByTestId(`requirement-card-${requirementId}`)
  readonly fieldError = (field: string) => this.page.locator(`#rfp-${field}-error`)

  async goto() {
    await this.page.goto('/pipeline')
    await this.board().waitFor()
  }

  async createRfp(v: { title: string; description: string; department: string; budgetMin?: string; budgetMax?: string }) {
    await this.page.getByRole('button', { name: 'New RFP' }).click()
    await this.page.locator('#rfp-title').fill(v.title)
    await this.page.locator('#rfp-description').fill(v.description)
    await this.page.locator('#rfp-department').fill(v.department)
    if (v.budgetMin) await this.page.locator('#rfp-budget-min').fill(v.budgetMin)
    if (v.budgetMax) await this.page.locator('#rfp-budget-max').fill(v.budgetMax)
    await this.page.getByRole('dialog').getByRole('button', { name: 'Create RFP' }).click()
  }

  async submitEmptyRfpForm() {
    await this.page.getByRole('button', { name: 'New RFP' }).click()
    await this.page.getByRole('dialog').getByRole('button', { name: 'Create RFP' }).click()
  }

  /** Inline card filter (App Flow §4) — narrows the board to matching cards. */
  async filterCards(text: string) {
    await this.page.getByLabel('Filter cards').fill(text)
  }

  /** Pointer drag (dnd-kit) from a card to a column. */
  async drag(rfpId: string, toStatus: string) {
    const card = this.card(rfpId)
    await card.scrollIntoViewIfNeeded()
    const a = (await card.boundingBox())!
    await this.page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
    await this.page.mouse.down()
    await this.page.mouse.move(a.x + a.width / 2 + 20, a.y + a.height / 2 + 5, { steps: 5 })
    const target = this.column(toStatus)
    await target.scrollIntoViewIfNeeded()
    const b = (await target.boundingBox())!
    await this.page.mouse.move(b.x + b.width / 2, b.y + 80, { steps: 15 })
    await this.page.mouse.up()
  }
}
