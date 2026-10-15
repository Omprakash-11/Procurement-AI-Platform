import { expect, test } from './fixtures/auth'
import { createRfp, db, inviteToken } from './helpers/db'
import { unique } from './helpers/env'
import { clearMail, waitForMail } from './helpers/mail'
import { PipelinePage } from './pages/PipelinePage'
import { RFPDetailPage } from './pages/RFPDetailPage'

// RFP lifecycle (Plan Phase 11 rfp.spec): create, invite, vendor status, drag between columns.

test.describe('RFP lifecycle', () => {
  test('PM creates an RFP from the pipeline; it lands in RFP Created with an evaluation', async ({ pmPage }) => {
    const pipeline = new PipelinePage(pmPage)
    await pipeline.goto()
    await pipeline.submitEmptyRfpForm()
    await expect(pipeline.fieldError('title')).toBeVisible()
    await pmPage.keyboard.press('Escape')

    const title = unique('Office laptops refresh')
    await pipeline.createRfp({ title, description: '120 laptops for the sales team, 3-year warranty.', department: 'Sales', budgetMin: '90000', budgetMax: '110000' })
    await expect(pipeline.column('rfp_created').getByText(title)).toBeVisible()

    const { data } = await db().from('rfps').select('id, status, evaluations(status)').eq('title', title).single()
    expect(data!.status).toBe('rfp_created')
    expect(data!.evaluations?.status).toBe('not_started')
  })

  test('PM invites a vendor: Invited row, invite email, RFP moves to Vendors Invited; duplicates refused', async ({ pmPage }) => {
    await clearMail()
    const rfpId = await createRfp(unique('Facilities cleaning services'))
    const detail = new RFPDetailPage(pmPage)
    await detail.goto(rfpId)

    const email = `${unique('ops').replace(/\s/g, '.').toLowerCase()}@cleanco.example`
    await detail.inviteVendor(email, 'CleanCo Facilities', 'We look forward to your proposal.')
    await expect(detail.vendorRow('CleanCo Facilities')).toContainText('Invited')
    await expect(detail.status()).toHaveText('Vendors Invited')

    const token = await inviteToken(email, rfpId)
    expect(token).toMatch(/^[A-Za-z0-9_-]{64}$/)
    const mail = await waitForMail(email, /invited/i)
    expect(mail.html).toContain(`/vendor/invite/${token}`)

    await detail.inviteVendor(email, 'CleanCo Facilities')
    await expect(detail.inviteEmailError()).toHaveText('This vendor has already been invited to this RFP.')
  })

  test('dragging a card changes its status; locked stages refuse the drop', async ({ pmPage }) => {
    const title = unique('Warehouse racking')
    const rfpId = await createRfp(title)
    const pipeline = new PipelinePage(pmPage)
    await pipeline.goto()
    await pipeline.filterCards(title)
    await expect(pipeline.card(rfpId)).toBeVisible()

    await pipeline.drag(rfpId, 'submissions_in')
    await expect(pipeline.column('submissions_in').getByTestId(`rfp-card-${rfpId}`)).toBeVisible()
    await expect.poll(async () => (await db().from('rfps').select('status').eq('id', rfpId).single()).data?.status).toBe('submissions_in')

    await pipeline.drag(rfpId, 'contracted')
    await expect(pipeline.column('submissions_in').getByTestId(`rfp-card-${rfpId}`)).toBeVisible()
    await expect.poll(async () => (await db().from('rfps').select('status').eq('id', rfpId).single()).data?.status).toBe('submissions_in')
  })
})
