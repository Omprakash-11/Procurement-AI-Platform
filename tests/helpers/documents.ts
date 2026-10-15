import type { Browser } from '@playwright/test'
import * as XLSX from 'xlsx'

// Realistic vendor proposals for the AI flow (decision P11-1): multi-section documents of the
// kind a procurement team receives, rendered to real PDFs with Chromium. One proposal carries
// typical risky clauses; the other is a strong, balanced offer.

const PROPOSAL_RISKY = `
<h1>Northwind Supplies — Managed Cloud Storage Proposal</h1>
<p>Prepared for: Acme Manufacturing, IT Department. Contact: Nina Patel, Account Director, nina.patel@northwind.example, +44 113 555 0100.</p>
<h2>1. Company overview</h2>
<p>Northwind Supplies Ltd was founded in 2009 and has 140 employees serving over 300 mid-sized customers across Europe.</p>
<h2>2. Commercial proposal</h2>
<p>Total contract price: USD 96,000 per year for 50 TB of managed storage, billed annually.</p>
<p>Cost breakdown: storage USD 72,000; support USD 18,000; onboarding USD 6,000.</p>
<p>100% of the annual fee is payable upfront within 7 days of invoice.</p>
<h2>3. Delivery plan</h2>
<p>Migration will be completed within 6 weeks of signature, with acceptance testing in week 6.</p>
<h2>4. Service levels</h2>
<p>We commit to 99.9% monthly availability, with service credits of 5% for each 0.1% below target.</p>
<h2>5. Contract terms</h2>
<p>The provider's total liability is unlimited for the customer and capped at USD 1,000 for the provider.</p>
<p>This agreement renews automatically for successive 3-year terms unless cancelled in writing at least 7 days before renewal.</p>
<p>Prices may increase at the provider's discretion at each renewal without limit.</p>
<p>The provider may amend these terms at any time by posting a notice on its website.</p>
<h2>6. Data protection</h2>
<p>Customer data is stored in EU data centres. No commitment is made regarding notification of data breaches.</p>`

const PROPOSAL_STRONG = `
<h1>Globex Services — Cloud Storage Services Proposal</h1>
<p>Prepared for: Acme Manufacturing. Contact: Gary Chen, Head of Sales, gary.chen@globex.example.</p>
<h2>1. About Globex</h2>
<p>Globex Services Inc has 25 years in business, 900 staff and is ISO 27001 certified and SOC 2 Type II audited.</p>
<h2>2. Pricing</h2>
<p>Total annual price: USD 110,000 per year for 50 TB, including support and onboarding (see the attached price sheet).</p>
<p>Payment is quarterly in arrears, net 45 days.</p>
<h2>3. Implementation</h2>
<p>Migration in 4 weeks with a dedicated project manager and weekly progress reviews.</p>
<h2>4. Service levels</h2>
<p>99.99% monthly availability, 1-hour response for severity 1 incidents, and service credits up to 30% of monthly fees.</p>
<h2>5. Contract terms</h2>
<p>Mutual liability cap of 12 months of fees; uncapped for data protection breaches and IP infringement.</p>
<p>Either party may terminate for convenience with 90 days notice. Price increases are capped at 3% per year.</p>
<p>All custom deliverables are owned by the customer.</p>
<h2>6. Data protection</h2>
<p>GDPR compliant; breach notification within 24 hours; the customer chooses the data residency region.</p>`

async function toPdf(browser: Browser, html: string): Promise<Buffer> {
  const page = await browser.newPage()
  await page.setContent(`<html><body style="font-family: Arial, sans-serif; font-size: 12px; line-height: 1.5">${html}</body></html>`)
  const pdf = await page.pdf({ format: 'A4', margin: { top: '20mm', bottom: '20mm', left: '18mm', right: '18mm' } })
  await page.close()
  return pdf
}

export const riskyProposalPdf = (browser: Browser) => toPdf(browser, PROPOSAL_RISKY)
export const strongProposalPdf = (browser: Browser) => toPdf(browser, PROPOSAL_STRONG)

/** An image-only PDF (no text layer) — "scanned" documents fail with the Tech Stack §6 message. */
export const scannedPdf = (browser: Browser) =>
  toPdf(browser, '<svg width="600" height="800"><rect x="40" y="40" width="500" height="700" fill="#888"/><circle cx="300" cy="300" r="120" fill="#333"/></svg>')

export function priceSheetXlsx(): Buffer {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['Item', 'Annual price (USD)'],
      ['Managed storage, 50 TB', 80000],
      ['Premium support', 20000],
      ['Onboarding (one-off)', 10000],
      ['Total', 110000],
    ]),
    'Pricing'
  )
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

export const MIME = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
} as const
