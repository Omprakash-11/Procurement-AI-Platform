// One-off capture of REAL Gemini output for the demo (decision P12-1).
//
// Runs the demo proposals through the actual app — vendor upload and submit, extraction,
// compliance, criteria suggestion, scoring, report — and saves the AI results to
// scripts/demo/ai-results.json plus the documents to scripts/demo/files/. The demo seed then
// loads those results, so every demo load is identical and uses no AI quota.
//
// Requires: local Supabase running, the app running on APP_URL (default http://localhost:3000)
// WITHOUT GEMINI_MOCK, and `npm run build` done. Uses only the local database.
//   node --env-file=.env.local scripts/demo/capture-ai.mjs

import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

import { HARBORLINE_PRICE_SHEET, PROPOSALS, RFPS } from './content.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright-core')
const XLSX = require('xlsx')

const here = dirname(fileURLToPath(import.meta.url))
const FILES = join(here, 'files')
const APP = process.env.APP_URL ?? 'http://localhost:3000'
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const PASSWORD = 'CaptureRun2026'
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(URL_ ?? '')) throw new Error('Capture runs against the local Supabase only.')

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const must = ({ data, error }) => {
  if (error) throw new Error(error.message)
  return data
}

async function cookieHeader(email) {
  const jar = []
  const supabase = createServerClient(URL_, ANON, { cookies: { getAll: () => jar, setAll: (c) => c.forEach(({ name, value }) => jar.push({ name, value })) } })
  const { error } = await supabase.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw new Error(`sign-in ${email}: ${error.message}`)
  return jar.map((c) => `${c.name}=${c.value}`).join('; ')
}

async function call(cookie, path, init = {}) {
  const res = await fetch(`${APP}${path}`, { ...init, headers: { 'Content-Type': 'application/json', cookie, ...(init.headers ?? {}) } })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status} ${JSON.stringify(body)}`)
  return body
}

async function ensureUser(email, appMetadata) {
  const { data } = await admin.rpc('find_auth_user_by_email', { p_email: email })
  if (data?.[0]?.id) return data[0].id
  const created = must(await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, app_metadata: appMetadata }))
  return created.user.id
}

async function main() {
  mkdirSync(FILES, { recursive: true })

  // 1) Documents: PDFs rendered by Chromium, price sheet by SheetJS.
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const files = {}
  for (const [key, p] of Object.entries(PROPOSALS)) {
    await page.setContent(`<html><body style="font-family: Arial, sans-serif; font-size: 11.5px; line-height: 1.55; color: #1f2937">${p.html}</body></html>`)
    files[key] = await page.pdf({ format: 'A4', margin: { top: '22mm', bottom: '22mm', left: '20mm', right: '20mm' } })
    writeFileSync(join(FILES, p.fileName), files[key])
  }
  await browser.close()
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(HARBORLINE_PRICE_SHEET), 'Pricing')
  const priceSheet = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  writeFileSync(join(FILES, 'Harborline-Price-Sheet.xlsx'), priceSheet)

  // 2) A capture org with a PM and three vendor accounts named like the demo vendors.
  const pmEmail = 'capture.pm@capture.test'
  const pmId = await ensureUser(pmEmail, { role: 'procurement_manager', org_name: 'Capture Workspace', full_name: 'Capture Manager' })
  await sleep(500)
  const org = must(await admin.from('profiles').select('org_id').eq('id', pmId).single()).org_id
  await admin.from('profiles').update({ onboarding_complete: true }).eq('id', pmId)
  const vendors = {}
  for (const [key, company] of [['harborline', 'Harborline Cloud Services'], ['summit', 'Summit Data Systems'], ['clearpath', 'ClearPath Security']]) {
    const email = `capture.${key}@capture.test`
    const uid = await ensureUser(email, {})
    const existing = (await admin.from('vendor_accounts').select('id').eq('org_id', org).eq('email', email).maybeSingle()).data
    vendors[key] = existing?.id ?? must(await admin.from('vendor_accounts').insert({ org_id: org, auth_user_id: uid, company_name: company, contact_name: company, email, is_active: true }).select('id').single()).id
  }

  async function makeRfp(brief, vendorKeys) {
    const rfp = must(await admin.from('rfps').insert({ org_id: org, created_by: pmId, title: brief.title, description: brief.description, department: brief.department, budget_min: brief.budgetMin, budget_max: brief.budgetMax, status: 'vendors_invited' }).select('id').single())
    for (const k of vendorKeys) must(await admin.from('rfp_vendor_entries').insert({ org_id: org, rfp_id: rfp.id, vendor_account_id: vendors[k], status: 'invited' }).select('id'))
    return rfp.id
  }

  async function submit(vendorKey, rfpId, docs) {
    const cookie = await cookieHeader(`capture.${vendorKey}@capture.test`)
    const { submissionId } = await call(cookie, '/api/submissions', { method: 'POST', body: JSON.stringify({ rfpId }) })
    for (const d of docs) {
      const { path, signedUrl } = await call(cookie, `/api/submissions/${submissionId}/documents`, { method: 'POST', body: JSON.stringify({ action: 'sign', fileName: d.name, fileSize: d.buffer.length, mimeType: d.mime }) })
      const put = await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': d.mime }, body: d.buffer })
      if (!put.ok) throw new Error(`upload ${d.name} → ${put.status}`)
      await call(cookie, `/api/submissions/${submissionId}/documents`, { method: 'POST', body: JSON.stringify({ action: 'confirm', path, fileName: d.name }) })
    }
    await call(cookie, `/api/submissions/${submissionId}/submit`, { method: 'POST' })
  }

  async function waitFor(fn, label, ms = 300_000) {
    const end = Date.now() + ms
    while (Date.now() < end) {
      if (await fn()) return
      await sleep(2000)
    }
    throw new Error(`timed out waiting for ${label}`)
  }

  const PDF = 'application/pdf'
  const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

  // 3) Storage RFP: two vendors, full evaluation and report.
  const storageId = await makeRfp(RFPS.storage, ['harborline', 'summit'])
  await submit('harborline', storageId, [
    { name: PROPOSALS.harborline.fileName, mime: PDF, buffer: files.harborline },
    { name: 'Harborline-Price-Sheet.xlsx', mime: XLSX_MIME, buffer: priceSheet },
  ])
  await submit('summit', storageId, [{ name: PROPOSALS.summit.fileName, mime: PDF, buffer: files.summit }])
  // 4) Endpoint RFP: one vendor, extraction + compliance only.
  const endpointId = await makeRfp(RFPS.endpoint, ['clearpath', 'harborline'])
  await submit('clearpath', endpointId, [{ name: PROPOSALS.clearpath.fileName, mime: PDF, buffer: files.clearpath }])

  const docsDone = async (rfpId) => {
    const rows = must(await admin.from('documents').select('extraction_status, submissions!inner(rfp_id)').eq('submissions.rfp_id', rfpId))
    return rows.length > 0 && rows.every((r) => ['extracted', 'failed'].includes(r.extraction_status))
  }
  console.log('waiting for extraction + compliance (real Gemini)…')
  await waitFor(() => docsDone(storageId), 'storage documents')
  await waitFor(() => docsDone(endpointId), 'endpoint documents')

  const pm = await cookieHeader(pmEmail)
  console.log('criteria suggestion…')
  const { criteria } = await call(pm, `/api/process/suggest-criteria/${storageId}`, { method: 'POST' })
  await call(pm, `/api/evaluations/${storageId}/criteria`, { method: 'PUT', body: JSON.stringify({ criteria }) })
  const evaluation = must(await admin.from('evaluations').select('id').eq('rfp_id', storageId).single())
  console.log('scoring…')
  await call(pm, `/api/process/score/${evaluation.id}`, { method: 'POST', body: '{}' })
  await waitFor(async () => must(await admin.from('evaluations').select('status').eq('id', evaluation.id).single()).status === 'scored', 'scoring')
  console.log('report…')
  await call(pm, `/api/process/report/${evaluation.id}`, { method: 'POST' })

  // 5) Export what the AI produced.
  const keyOf = Object.fromEntries(Object.entries(vendors).map(([k, id]) => [id, k]))
  const documents = must(
    await admin
      .from('documents')
      .select('file_name, file_type, file_size_bytes, extraction_status, extraction_error, raw_extraction, extracted_vendor_name, extracted_pricing, extracted_payment_terms, extracted_delivery, extracted_sla, extracted_warranty, extracted_termination, extracted_data_privacy, submissions!inner(rfp_id, vendor_account_id), compliance_flags(flag_type, severity, clause_text, explanation)')
      .in('submissions.rfp_id', [storageId, endpointId])
  ).map(({ submissions, ...d }) => ({ rfp: submissions.rfp_id === storageId ? 'storage' : 'endpoint', vendor: keyOf[submissions.vendor_account_id], ...d }))
  const savedCriteria = must(await admin.from('evaluation_criteria').select('id, name, description, weight, sort_order, is_ai_suggested').eq('evaluation_id', evaluation.id).order('sort_order'))
  const nameOf = Object.fromEntries(savedCriteria.map((c) => [c.id, c.name]))
  const scores = must(await admin.from('vendor_scores').select('criterion_id, vendor_account_id, ai_score, ai_reasoning').eq('evaluation_id', evaluation.id)).map((s) => ({ vendor: keyOf[s.vendor_account_id], criterion: nameOf[s.criterion_id], score: Number(s.ai_score), reasoning: s.ai_reasoning }))
  const report = must(await admin.from('evaluations').select('report_executive_summary, report_recommendation').eq('id', evaluation.id).single())
  const rec = JSON.parse(report.report_recommendation)

  const out = {
    capturedAt: new Date().toISOString(),
    note: 'Real Gemini output captured by scripts/demo/capture-ai.mjs; loaded by the demo seed.',
    documents,
    criteria: savedCriteria.map(({ id: _id, ...c }) => ({ ...c, weight: Number(c.weight) })),
    scores,
    report: { executiveSummary: report.report_executive_summary, recommendedVendor: keyOf[rec.vendor_account_id] ?? null, rationale: rec.rationale },
  }
  writeFileSync(join(here, 'ai-results.json'), `${JSON.stringify(out, null, 2)}\n`)
  console.log(`saved ${documents.length} documents, ${savedCriteria.length} criteria, ${scores.length} scores; recommended: ${out.report.recommendedVendor}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
