import type { Browser, Page } from '@playwright/test'

import { expect, test } from './fixtures/auth'
import { createRfp, db, enrolVendor } from './helpers/db'
import { MIME, priceSheetXlsx, riskyProposalPdf, scannedPdf, strongProposalPdf } from './helpers/documents'
import { SEED, unique } from './helpers/env'
import { ReportPage } from './pages/ReportPage'
import { RFPDetailPage } from './pages/RFPDetailPage'
import { VendorDetailPage } from './pages/VendorDetailPage'
import { VendorPortalPage } from './pages/VendorPortalPage'

// AI processing (decision P11-1): two vendors submit realistic proposals; documents are
// extracted and risk-checked, criteria are suggested, both vendors scored, the report written.
// By default the test-only stand-in answers from the documents' own text; `@live-ai` runs the
// same flow on real Gemini (LIVE_AI=1 npx playwright test --grep @live-ai).

const SCANNED = 'This document appears to be a scanned image. Text extraction is not supported for scanned files in this version.'

async function documentsDone(rfpId: string) {
  const { data } = await db().from('documents').select('extraction_status, submissions!inner(rfp_id)').eq('submissions.rfp_id', rfpId)
  return (data ?? []).length > 0 && (data ?? []).every((d) => d.extraction_status === 'extracted' || d.extraction_status === 'failed')
}

async function submitProposals(browser: Browser, vendorPage: Page, vendor2Page: Page, rfpId: string) {
  const v1 = new VendorPortalPage(vendorPage)
  await v1.gotoRfp(rfpId)
  await v1.upload('Northwind-Proposal.pdf', MIME.pdf, await riskyProposalPdf(browser))
  await expect(v1.uploaded('Northwind-Proposal.pdf')).toBeVisible({ timeout: 20_000 })
  await v1.upload('Signed-Annex-Scan.pdf', MIME.pdf, await scannedPdf(browser))
  await expect(v1.uploaded('Signed-Annex-Scan.pdf')).toBeVisible({ timeout: 20_000 })
  await v1.submit()
  await expect(v1.submittedMessage()).toBeVisible()

  const v2 = new VendorPortalPage(vendor2Page)
  await v2.gotoRfp(rfpId)
  await v2.upload('Globex-Proposal.pdf', MIME.pdf, await strongProposalPdf(browser))
  await expect(v2.uploaded('Globex-Proposal.pdf')).toBeVisible({ timeout: 20_000 })
  await v2.upload('Globex-Price-Sheet.xlsx', MIME.xlsx, priceSheetXlsx())
  await expect(v2.uploaded('Globex-Price-Sheet.xlsx')).toBeVisible({ timeout: 20_000 })
  await v2.submit()
  await expect(v2.submittedMessage()).toBeVisible()
}

async function runFlow(browser: Browser, pmPage: Page, vendorPage: Page, vendor2Page: Page, live: boolean) {
  const rfpId = await createRfp(unique('Managed cloud storage'), { status: 'vendors_invited', description: 'Managed storage for 50 TB of engineering data, with migration and 24/7 support.' })
  await enrolVendor(rfpId, SEED.vendor1Id)
  await enrolVendor(rfpId, SEED.vendor2Id)
  await submitProposals(browser, vendorPage, vendor2Page, rfpId)

  // Extraction + compliance run in the background after each submit.
  await expect.poll(() => documentsDone(rfpId), { timeout: live ? 300_000 : 60_000, intervals: [1000] }).toBe(true)
  const vendorDetail = new VendorDetailPage(pmPage)
  await vendorDetail.goto(rfpId, SEED.vendor1Id)
  await expect(vendorDetail.documentRow('Northwind-Proposal.pdf')).toContainText('Extracted')
  await expect(vendorDetail.failedBanner()).toContainText(SCANNED)
  await vendorDetail.viewExtractedData()
  await expect(vendorDetail.extractedPanel()).toBeVisible()
  await expect(pmPage.getByText(/96,000/).first()).toBeVisible()

  await vendorDetail.tab('Compliance')
  await expect.poll(async () => Number(await vendorDetail.flagCount('high').textContent())).toBeGreaterThanOrEqual(live ? 1 : 4)
  if (!live) {
    await expect(vendorDetail.flagsTable()).toContainText('Payment terms')
    await expect(vendorDetail.flagsTable()).toContainText('Auto-renewal')
    await expect(vendorDetail.flagsTable()).toContainText('Unilateral modification')
  }

  // Evaluation: AI-suggested criteria → confirm → scoring.
  const rfp = new RFPDetailPage(pmPage)
  await rfp.goto(rfpId)
  await rfp.openCriteriaModal()
  await expect(rfp.criteriaList().locator('li').first()).toBeVisible({ timeout: live ? 240_000 : 20_000 })
  const count = await rfp.criteriaList().locator('li').count()
  expect(count).toBeGreaterThanOrEqual(5)
  expect(count).toBeLessThanOrEqual(10)
  await expect(rfp.criteriaTotal()).toHaveText('Total: 100%')
  const first = await rfp.criterionWeight(1)
  await rfp.setCriterionWeight(1, String(Number(first) + 5))
  await expect(rfp.confirmScoring()).toBeDisabled()
  await rfp.setCriterionWeight(1, first)
  await rfp.confirmScoring().click()
  await expect(rfp.scoringInProgress()).toBeVisible()

  const { data: evaluation } = await db().from('evaluations').select('id').eq('rfp_id', rfpId).single()
  await expect
    .poll(async () => (await db().from('evaluations').select('status').eq('id', evaluation!.id).single()).data?.status, { timeout: live ? 300_000 : 60_000, intervals: [1000] })
    .toBe('scored')

  await vendorDetail.goto(rfpId, SEED.vendor1Id)
  await vendorDetail.tab('Scores')
  await expect(vendorDetail.scoresTable().locator('tbody tr').first()).toBeVisible()
  await expect(vendorDetail.vendorTotal()).toBeVisible()
  if (!live) await expect(vendorDetail.scoresTable()).toContainText(/upfront/i)

  // Totals: the balanced proposal should outscore the one with risky terms.
  const totals = await db().from('vendor_scores').select('vendor_account_id, ai_score').eq('evaluation_id', evaluation!.id)
  const avg = (id: string) => {
    const rows = (totals.data ?? []).filter((r) => r.vendor_account_id === id)
    return rows.reduce((s, r) => s + Number(r.ai_score), 0) / rows.length
  }
  if (!live) expect(avg(SEED.vendor2Id)).toBeGreaterThan(avg(SEED.vendor1Id))

  // Report.
  await rfp.goto(rfpId)
  await rfp.generateReportButton().click()
  await expect(pmPage).toHaveURL(new RegExp(`/pipeline/rfp/${rfpId}/report`), { timeout: live ? 240_000 : 30_000 })
  const report = new ReportPage(pmPage)
  for (const name of ['Executive Summary', 'Vendor Scorecard', 'Compliance Risk Summary', 'Key Terms Comparison']) {
    await expect(report.section(name)).toBeVisible()
  }
  await expect(report.recommendation()).toContainText('AI Recommendation — Advisory Only')
  if (!live) await expect(report.recommendation()).toContainText('Globex Services')
}

test.describe('AI processing', () => {
  test('documents are extracted and risk-checked; criteria, scores and report follow', async ({ browser, pmPage, vendorPage, vendor2Page }) => {
    test.setTimeout(150_000)
    await runFlow(browser, pmPage, vendorPage, vendor2Page, false)
  })

  test('the same flow on real Gemini @live-ai', async ({ browser, pmPage, vendorPage, vendor2Page }) => {
    test.setTimeout(900_000)
    await runFlow(browser, pmPage, vendorPage, vendor2Page, true)
  })
})
