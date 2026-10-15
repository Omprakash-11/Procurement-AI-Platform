import { expect, test } from './fixtures/auth'
import { createRfp, db, inviteToken } from './helpers/db'
import { PASSWORD, unique } from './helpers/env'
import { MIME, strongProposalPdf } from './helpers/documents'
import { RFPDetailPage } from './pages/RFPDetailPage'
import { VendorPortalPage } from './pages/VendorPortalPage'

// Vendor portal (Tech Stack §12.2): invite link → accept → upload → submit → PM sees it.

test.describe('Vendor portal', () => {
  test('a new vendor accepts an invite, uploads a proposal and submits; the PM sees it submitted', async ({ browser, pmPage, baseURL }) => {
    test.setTimeout(60_000)
    const title = unique('Managed print services')
    const rfpId = await createRfp(title)
    const email = `${unique('bids').replace(/\s/g, '.').toLowerCase()}@printwise.example`
    const invited = await pmPage.request.post(`/api/rfps/${rfpId}/invite-vendor`, { data: { email, companyName: 'PrintWise Ltd', personalMessage: '' } })
    expect(invited.status()).toBe(201)

    // The vendor follows the emailed link in a fresh browser (not signed in).
    const vendorContext = await browser.newContext({ baseURL: baseURL! })
    const portal = new VendorPortalPage(await vendorContext.newPage())
    await portal.acceptNewInvite(await inviteToken(email, rfpId), { fullName: 'Priya Raman', password: PASSWORD })
    await expect(portal.page).toHaveURL(new RegExp(`/vendor/rfp/${rfpId}`))

    await portal.gotoHome()
    await expect(portal.myRfpRow(title)).toContainText('Invited')

    await portal.gotoRfp(rfpId)
    await expect(portal.submitButton()).toBeDisabled()
    await portal.upload('notes.txt', 'text/plain', Buffer.from('not a proposal'))
    await expect(portal.uploadError()).toHaveText(/Only PDF, DOCX, and XLSX files are supported/)
    await portal.upload('PrintWise-Proposal.pdf', MIME.pdf, await strongProposalPdf(browser))
    await expect(portal.uploaded('PrintWise-Proposal.pdf')).toBeVisible({ timeout: 20_000 })
    await portal.submit()
    await expect(portal.submittedMessage()).toBeVisible()
    await expect(portal.status()).toHaveText('Submitted')

    const detail = new RFPDetailPage(pmPage)
    await detail.goto(rfpId)
    await expect(detail.vendorRow('PrintWise Ltd')).toContainText('Submitted')
    await expect(detail.status()).toHaveText('Submissions In')
    const { data } = await db().from('submissions').select('status').eq('rfp_id', rfpId).single()
    expect(data!.status).toBe('submitted')
    await vendorContext.close()
  })
})
