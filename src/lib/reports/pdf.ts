import { existsSync } from 'node:fs'

import puppeteer from 'puppeteer-core'

// Decision P7-8: puppeteer-core everywhere — @sparticuz/chromium on Vercel, a locally installed
// Edge (or Chrome) for Windows development.
const LOCAL_BROWSERS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]

async function launch() {
  if (process.env.VERCEL) {
    const chromium = (await import('@sparticuz/chromium')).default
    return puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: chromium.headless })
  }
  const executablePath = LOCAL_BROWSERS.find((p) => existsSync(p))
  if (!executablePath) throw new Error('No local Chromium-based browser found for PDF export.')
  return puppeteer.launch({ executablePath, headless: true, args: ['--no-first-run', '--no-default-browser-check'] })
}

/** Render a standalone HTML document (no external requests) to an A4 PDF. */
export async function htmlToPdf(html: string): Promise<Uint8Array> {
  const browser = await launch()
  try {
    const page = await browser.newPage()
    // The report HTML is self-contained; block every network request it might still make.
    await page.setRequestInterception(true)
    page.on('request', (req) => (req.url().startsWith('data:') ? req.continue() : req.abort()))
    await page.setContent(html, { waitUntil: 'load' })
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '18mm', bottom: '18mm', left: '14mm', right: '14mm' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#64748B">ProcureMaster · <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    })
  } finally {
    await browser.close()
  }
}
