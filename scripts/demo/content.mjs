// Demo content (decision P12-1): RFP briefs and vendor proposals for the fictional company
// Northbridge Industries. Shared by the one-off AI capture (which turns the proposals into PDFs
// and runs them through real Gemini) and by the demo seed. Names and figures are illustrative.

export const RFPS = {
  storage: {
    title: 'Managed Cloud Storage Platform',
    department: 'Engineering',
    description:
      'Northbridge Industries needs a managed cloud storage platform for 60 TB of engineering design data, growing about 20% a year. Requirements: migration from on-premise file servers within 8 weeks, 99.9% or better availability, encryption at rest and in transit, EU data residency, daily backups with 30-day retention, and 24/7 support. Three-year term preferred.',
    budgetMin: 90000,
    budgetMax: 130000,
  },
  endpoint: {
    title: 'Endpoint Security Software',
    department: 'IT Security',
    description:
      'Replacement endpoint protection for 850 laptops and 120 servers: next-generation antivirus, endpoint detection and response, central management console, and integration with the existing identity provider. Rollout within 6 weeks, with a 24/7 incident response option.',
    budgetMin: 60000,
    budgetMax: 85000,
  },
}

export const PROPOSALS = {
  harborline: {
    fileName: 'Harborline-Cloud-Storage-Proposal.pdf',
    html: `
<h1>Harborline Cloud Services — Managed Cloud Storage Proposal</h1>
<p>Prepared for Northbridge Industries, Engineering. Contact: Taylor Brooks, Enterprise Account Manager, taylor.brooks@harborline.example, +1 415 555 0142.</p>
<h2>1. Company overview</h2>
<p>Harborline Cloud Services was founded in 2014 and has 220 employees supporting more than 400 business customers in North America and Europe.</p>
<h2>2. Commercial proposal</h2>
<p>Total contract price: USD 98,400 per year for 60 TB of managed storage, including standard support.</p>
<p>Cost breakdown: storage capacity USD 79,200; standard support USD 12,000; migration services USD 7,200 (one-off, first year).</p>
<p>100% of the annual fee is payable upfront within 14 days of invoice.</p>
<p>Capacity above 60 TB is charged at USD 140 per TB per month; data egress and API request charges are billed separately as additional fees.</p>
<h2>3. Migration plan</h2>
<p>Migration from on-premise file servers will be completed within 10 weeks of signature, in three waves with weekly status reports.</p>
<h2>4. Service levels</h2>
<p>We commit to 99.9% monthly availability, with service credits of 5% of the monthly fee for each 0.1% below target, capped at 15%.</p>
<p>Support is available business hours (08:00–18:00 local time); 24/7 support is an optional add-on.</p>
<h2>5. Contract terms</h2>
<p>The initial term is three years. This agreement renews automatically for successive one-year terms unless cancelled in writing at least 30 days before renewal.</p>
<p>Prices may increase at each renewal at the provider's discretion.</p>
<p>The provider's total liability under this agreement is capped at the fees paid in the preceding three months.</p>
<h2>6. Data protection</h2>
<p>Customer data is stored in EU data centres and encrypted at rest (AES-256) and in transit (TLS 1.2+). Daily backups are retained for 14 days.</p>
<p>The provider will notify the customer of a confirmed personal data breach without undue delay.</p>`,
  },
  summit: {
    fileName: 'Summit-Data-Systems-Storage-Proposal.pdf',
    html: `
<h1>Summit Data Systems — Cloud Storage Services Proposal</h1>
<p>Prepared for Northbridge Industries. Contact: Casey Nguyen, Head of Enterprise Sales, casey.nguyen@summitdata.example.</p>
<h2>1. About Summit</h2>
<p>Summit Data Systems has 18 years in business, 650 staff and is ISO 27001 certified and SOC 2 Type II audited, serving over 1,200 enterprise customers.</p>
<h2>2. Pricing</h2>
<p>Total annual price: USD 112,800 per year for 60 TB, including 24/7 support, migration and onboarding.</p>
<p>Payment is quarterly in arrears, net 45 days. Price increases are capped at 3% per year.</p>
<h2>3. Implementation</h2>
<p>Migration in 6 weeks with a dedicated project manager, a solution architect and fortnightly steering reviews.</p>
<h2>4. Service levels</h2>
<p>99.99% monthly availability, 1-hour response for severity 1 incidents, and service credits up to 25% of monthly fees.</p>
<h2>5. Contract terms</h2>
<p>Three-year term. Mutual liability cap of 12 months of fees; uncapped for data protection breaches and confidentiality.</p>
<p>Either party may terminate for convenience with 90 days notice after the first year. All custom scripts and configurations are owned by the customer.</p>
<h2>6. Data protection</h2>
<p>GDPR compliant; breach notification within 24 hours; EU data residency (Frankfurt and Dublin); daily backups retained for 35 days.</p>`,
  },
  clearpath: {
    fileName: 'ClearPath-Endpoint-Security-Proposal.pdf',
    html: `
<h1>ClearPath Security — Endpoint Protection Proposal</h1>
<p>Prepared for Northbridge Industries, IT Security. Contact: Riley Chen, Solutions Director, riley.chen@clearpath.example.</p>
<h2>1. Company overview</h2>
<p>ClearPath Security was established in 2011, has 310 employees and protects over 2,000 organisations.</p>
<h2>2. Commercial proposal</h2>
<p>Total annual price: USD 71,500 for 850 endpoints and 120 servers, including EDR and the central console.</p>
<p>Payment terms: annually in advance, net 30 days.</p>
<p>The 24/7 managed incident response service is available at an additional fee of USD 18,000 per year.</p>
<h2>3. Deployment</h2>
<p>Rollout in 5 weeks, starting with a two-week pilot on 100 devices.</p>
<h2>4. Service levels</h2>
<p>Console availability of 99.9%, with 4-hour response for critical incidents.</p>
<h2>5. Contract terms</h2>
<p>Two-year term. This agreement renews automatically for 12 months unless either party gives 60 days notice.</p>
<p>The agreement is governed by the laws of the State of Delaware.</p>
<h2>6. Data protection</h2>
<p>Telemetry is processed in the EU; ISO 27001 certified; breach notification within 48 hours.</p>`,
  },
}

/** Harborline's price sheet (XLSX) rows. */
export const HARBORLINE_PRICE_SHEET = [
  ['Item', 'Annual price (USD)'],
  ['Managed storage, 60 TB', 79200],
  ['Standard support (business hours)', 12000],
  ['Migration services (one-off, year 1)', 7200],
  ['Total', 98400],
  ['Optional: 24/7 support add-on', 9600],
]
