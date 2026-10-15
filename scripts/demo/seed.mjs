// Demo organisation loader (decisions P12-1, P12-3).
//
//   npm run demo:seed     → load "Northbridge Industries" into the local Supabase (once)
//   npm run demo:reset    → wipe that organisation (only it) and load it again
//   Production: node --env-file=.env.production.local scripts/demo/seed.mjs --reset --production
//
// Uses the service role. Creates accounts the supported way (admin API, role / org in
// app_metadata), uploads the demo documents and loads the AI results captured from real Gemini
// (scripts/demo/ai-results.json), so the demo is realistic, identical on every load and uses no
// AI quota. All names and companies are fictional.

import { randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'

import { PROPOSALS, RFPS } from './content.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const ACCOUNTS = JSON.parse(readFileSync(join(here, 'accounts.json'), 'utf8'))
const AI = JSON.parse(readFileSync(join(here, 'ai-results.json'), 'utf8'))
const args = new Set(process.argv.slice(2))

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !SERVICE) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (use --env-file).')
const isLocal = /^http:\/\/(127\.0\.0\.1|localhost)/.test(URL_)
if (!isLocal && !args.has('--production')) throw new Error('Refusing to touch a hosted Supabase project without --production.')

const db = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
const must = ({ data, error }, label = 'query') => {
  if (error) throw new Error(`${label}: ${error.message}`)
  return data
}
const DAY = 86_400_000
const ago = (days, hour = 10) => {
  const d = new Date(Date.now() - days * DAY)
  d.setUTCHours(hour, (days * 7) % 60, 0, 0)
  return d.toISOString()
}
const inDays = (days) => new Date(Date.now() + days * DAY).toISOString()
const dateIn = (days) => new Date(Date.now() + days * DAY).toISOString().slice(0, 10)
const safeName = (name) => name.normalize('NFKD').replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '-').slice(-120)
const addBusinessDays = (iso, n) => {
  const d = new Date(iso)
  let added = 0
  while (added < n) {
    d.setUTCDate(d.getUTCDate() + 1)
    if (d.getUTCDay() % 6 !== 0) added += 1
  }
  return d.toISOString()
}

async function findUserId(email) {
  const { data } = await db.rpc('find_auth_user_by_email', { p_email: email })
  return data?.[0]?.id ?? null
}

// ── Reset (only the demo organisation) ──────────────────────────────────────

async function removeDemo() {
  const pmId = await findUserId(ACCOUNTS.internal[0].email)
  if (pmId) {
    const profile = (await db.from('profiles').select('org_id, organisations(name)').eq('id', pmId).maybeSingle()).data
    if (profile) {
      if (profile.organisations?.name !== ACCOUNTS.organisation) throw new Error('Safety stop: the demo PM belongs to an unexpected organisation.')
      for (const bucket of ['vendor-documents', 'contract-documents', 'org-assets']) await removePrefix(bucket, profile.org_id)
      must(await db.from('organisations').delete().eq('id', profile.org_id), 'delete organisation')
    }
  }
  for (const a of [...ACCOUNTS.internal, ...ACCOUNTS.vendors]) {
    const id = await findUserId(a.email)
    if (id) must(await db.auth.admin.deleteUser(id), `delete ${a.email}`)
  }
}

async function removePrefix(bucket, prefix) {
  const { data } = await db.storage.from(bucket).list(prefix, { limit: 1000 })
  for (const entry of data ?? []) {
    const path = `${prefix}/${entry.name}`
    if (entry.id === null) await removePrefix(bucket, path)
    else await db.storage.from(bucket).remove([path])
  }
}

// ── Load ─────────────────────────────────────────────────────────────────────

async function createAccount(email, appMetadata, fullName) {
  const created = must(await db.auth.admin.createUser({ email, password: ACCOUNTS.password, email_confirm: true, user_metadata: { full_name: fullName }, app_metadata: appMetadata }), `create ${email}`)
  return created.user.id
}

async function load() {
  // People
  const [pmA, dhA, faA] = ACCOUNTS.internal
  const pm = await createAccount(pmA.email, { role: 'procurement_manager', org_name: ACCOUNTS.organisation, full_name: pmA.fullName, currency: 'USD' }, pmA.fullName)
  const org = must(await db.from('profiles').select('org_id').eq('id', pm).single(), 'pm profile').org_id
  const dh = await createAccount(dhA.email, { role: 'department_head', org_id: org, full_name: dhA.fullName }, dhA.fullName)
  const fa = await createAccount(faA.email, { role: 'finance_approver', org_id: org, full_name: faA.fullName }, faA.fullName)
  must(await db.from('profiles').update({ onboarding_complete: true }).eq('org_id', org), 'onboarding')

  const vendor = {}
  for (const v of ACCOUNTS.vendors) {
    const uid = await createAccount(v.email, {}, v.contact)
    vendor[v.key] = must(await db.from('vendor_accounts').insert({ org_id: org, auth_user_id: uid, company_name: v.company, contact_name: v.contact, email: v.email, is_active: true, created_at: ago(40) }).select('id').single(), 'vendor').id
  }
  const vendorName = Object.fromEntries(ACCOUNTS.vendors.map((v) => [v.key, v.company]))

  const activity = []
  const log = (e) => activity.push({ org_id: org, actor_type: e.actorId ? (e.vendor ? 'vendor' : 'profile') : 'system', actor_id: e.actorId ?? null, entity_type: e.type, entity_id: e.id, action: e.action, description: e.text, before_state: e.before ?? null, after_state: e.after ?? null, metadata: e.meta ?? null, created_at: e.at })

  const insertRfp = async (r) => must(await db.from('rfps').insert({ org_id: org, created_by: pm, ...r }).select('id').single(), `rfp ${r.title}`).id

  // ── Requirements ──
  const reqStorage = must(await db.from('requirements').insert({ org_id: org, raised_by: dh, title: 'Managed storage for engineering design data', description: 'Our on-premise file servers are near capacity and out of support. We need a managed cloud storage platform for about 60 TB of design data, with EU data residency, daily backups and 24/7 support. Migration must finish within one quarter.', department: 'Engineering', budget_estimate: 120000, required_by: dateIn(45), priority: 'high', status: 'in_progress', created_at: ago(27, 9) }).select('id').single(), 'req').id
  log({ actorId: dh, type: 'requirement', id: reqStorage, action: 'requirement.submitted', text: 'Requirement "Managed storage for engineering design data" submitted', at: ago(27, 9) })
  const reqLaptops = must(await db.from('requirements').insert({ org_id: org, raised_by: dh, title: 'Laptops for new engineering hires', description: '25 developer laptops (32 GB RAM, 1 TB SSD) for new starters joining next quarter, with 3-year on-site warranty.', department: 'Engineering', budget_estimate: 55000, required_by: dateIn(60), priority: 'medium', status: 'submitted', created_at: ago(2, 14) }).select('id').single(), 'req').id
  log({ actorId: dh, type: 'requirement', id: reqLaptops, action: 'requirement.submitted', text: 'Requirement "Laptops for new engineering hires" submitted', at: ago(2, 14) })

  // ── RFP 1: Managed Cloud Storage — full evaluation, report, pending approval ──
  const storage = await insertRfp({ requirement_id: reqStorage, title: RFPS.storage.title, description: RFPS.storage.description, department: RFPS.storage.department, budget_min: RFPS.storage.budgetMin, budget_max: RFPS.storage.budgetMax, submission_deadline: ago(9, 23), status: 'approval_pending', created_at: ago(25) })
  must(await db.from('requirements').update({ linked_rfp_id: storage }).eq('id', reqStorage), 'link')
  log({ actorId: pm, type: 'rfp', id: storage, action: 'rfp.created', text: `RFP "${RFPS.storage.title}" created from a requirement`, after: { status: 'rfp_created' }, meta: { rfp_id: storage }, at: ago(25) })

  const docsFor = (rfp, key) => AI.documents.filter((d) => d.rfp === rfp && d.vendor === key)
  const fileFor = (fileName) => readFileSync(join(here, 'files', fileName))

  async function submitVendor(rfpId, key, { entryStatus, submittedDaysAgo, rfpTitle }) {
    const entry = must(await db.from('rfp_vendor_entries').insert({ org_id: org, rfp_id: rfpId, vendor_account_id: vendor[key], status: entryStatus, is_shortlisted: entryStatus === 'shortlisted', created_at: ago(submittedDaysAgo + 6) }).select('id').single(), 'entry').id
    must(await db.from('vendor_invites').insert({ org_id: org, rfp_id: rfpId, vendor_account_id: vendor[key], invited_by: pm, token: randomBytes(32).toString('hex'), status: 'accepted', expires_at: ago(submittedDaysAgo + 3), accepted_at: ago(submittedDaysAgo + 5), created_at: ago(submittedDaysAgo + 6) }), 'invite')
    log({ actorId: pm, type: 'rfp_vendor_entry', id: entry, action: 'vendor.invited', text: `${vendorName[key]} invited to "${rfpTitle}"`, after: { status: 'invited' }, meta: { rfp_id: rfpId, vendor_account_id: vendor[key] }, at: ago(submittedDaysAgo + 6, 11) })
    const submission = must(await db.from('submissions').insert({ org_id: org, rfp_id: rfpId, vendor_account_id: vendor[key], rfp_vendor_entry_id: entry, status: entryStatus === 'submitted' ? 'submitted' : 'under_review', submitted_at: ago(submittedDaysAgo, 16), created_at: ago(submittedDaysAgo + 1) }).select('id').single(), 'submission').id
    log({ actorId: vendor[key], vendor: true, type: 'submission', id: submission, action: 'vendor.submitted', text: `${vendorName[key]} submitted a proposal for "${rfpTitle}"`, before: { status: 'in_progress' }, after: { status: 'submitted' }, meta: { rfp_id: rfpId, vendor_account_id: vendor[key] }, at: ago(submittedDaysAgo, 16) })
    const flags = []
    // Proposal PDFs first, then supporting sheets — the report's key terms come from the first.
    const docs = docsFor(rfpId === storage ? 'storage' : 'endpoint', key).sort((x, y) => (x.file_type === 'pdf' ? 0 : 1) - (y.file_type === 'pdf' ? 0 : 1))
    for (const [i, d] of docs.entries()) {
      const path = `${org}/${rfpId}/${vendor[key]}/${randomUUID()}-${safeName(d.file_name)}`
      must(await db.storage.from('vendor-documents').upload(path, fileFor(d.file_name), { contentType: d.file_type === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'upload')
      const doc = must(
        await db
          .from('documents')
          .insert({
            org_id: org,
            submission_id: submission,
            file_name: d.file_name,
            file_type: d.file_type,
            file_size_bytes: d.file_size_bytes,
            storage_path: path,
            extraction_status: 'extracted',
            extraction_attempts: 1,
            last_extracted_at: ago(submittedDaysAgo, 17),
            raw_extraction: d.raw_extraction,
            extracted_vendor_name: d.extracted_vendor_name,
            extracted_pricing: d.extracted_pricing,
            extracted_payment_terms: d.extracted_payment_terms,
            extracted_delivery: d.extracted_delivery,
            extracted_sla: d.extracted_sla,
            extracted_warranty: d.extracted_warranty,
            extracted_termination: d.extracted_termination,
            extracted_data_privacy: d.extracted_data_privacy,
            created_at: ago(submittedDaysAgo + 1, 9 + i),
          })
          .select('id')
          .single(),
        'document'
      ).id
      log({ type: 'document', id: doc, action: 'document.extracted', text: `Extraction completed for "${d.file_name}" (${vendorName[key]}) — ${d.compliance_flags.length} compliance flags`, after: { extraction_status: 'extracted', compliance_flags: d.compliance_flags.length }, meta: { rfp_id: rfpId, vendor_account_id: vendor[key], submission_id: submission }, at: ago(submittedDaysAgo, 17) })
      for (const f of d.compliance_flags) flags.push({ org_id: org, document_id: doc, flag_type: f.flag_type, severity: f.severity, clause_text: f.clause_text, explanation: f.explanation, created_at: ago(submittedDaysAgo, 17) })
    }
    const inserted = flags.length ? must(await db.from('compliance_flags').insert(flags).select('id, flag_type, severity, document_id'), 'flags') : []
    return { entry, submission, flags: inserted }
  }

  const harborStorage = await submitVendor(storage, 'harborline', { entryStatus: 'under_review', submittedDaysAgo: 12, rfpTitle: RFPS.storage.title })
  const summitStorage = await submitVendor(storage, 'summit', { entryStatus: 'shortlisted', submittedDaysAgo: 11, rfpTitle: RFPS.storage.title })

  // Flag review by the PM: price-sheet items acknowledged, the liability cap escalated to Finance.
  const liability = harborStorage.flags.find((f) => f.flag_type === 'liability_limitation')
  if (liability) must(await db.from('compliance_flags').update({ status: 'escalated', acknowledged_by: pm, acknowledged_at: ago(4, 15) }).eq('id', liability.id), 'escalate')
  const feeFlag = harborStorage.flags.find((f) => f.flag_type === 'fee_structure')
  if (feeFlag) must(await db.from('compliance_flags').update({ status: 'acknowledged', acknowledged_by: pm, acknowledged_at: ago(4, 15) }).eq('id', feeFlag.id), 'ack')

  const evaluation = must(await db.from('evaluations').select('id').eq('rfp_id', storage).single(), 'evaluation').id
  const criteria = must(await db.from('evaluation_criteria').insert(AI.criteria.map((c) => ({ org_id: org, evaluation_id: evaluation, name: c.name, description: c.description, weight: c.weight, sort_order: c.sort_order, is_ai_suggested: c.is_ai_suggested, created_at: ago(8) }))).select('id, name'), 'criteria')
  const criterionId = Object.fromEntries(criteria.map((c) => [c.name, c.id]))
  must(await db.from('vendor_scores').insert(AI.scores.map((s) => ({ org_id: org, evaluation_id: evaluation, criterion_id: criterionId[s.criterion], vendor_account_id: vendor[s.vendor], scoring_run: 1, ai_score: s.score, ai_reasoning: s.reasoning, ai_scored_at: ago(8, 12), created_at: ago(8, 12) }))), 'scores')
  must(await db.from('evaluations').update({ status: 'report_generated', scoring_run_count: 1, criteria_confirmed_at: ago(8, 11), criteria_confirmed_by: pm, last_scored_at: ago(8, 12), report_executive_summary: AI.report.executiveSummary, report_recommendation: JSON.stringify({ vendor_account_id: AI.report.recommendedVendor ? vendor[AI.report.recommendedVendor] : null, rationale: AI.report.rationale }), report_generated_at: ago(6, 10) }).eq('id', evaluation), 'report')
  log({ actorId: pm, type: 'evaluation', id: evaluation, action: 'evaluation.criteria_confirmed', text: `Scoring criteria confirmed for "${RFPS.storage.title}" (${criteria.length} criteria)`, after: { criteria: AI.criteria.map((c) => ({ name: c.name, weight: c.weight })) }, meta: { rfp_id: storage }, at: ago(8, 11) })
  log({ type: 'evaluation', id: evaluation, action: 'evaluation.scored', text: `Scoring completed for "${RFPS.storage.title}" — 2 of 2 vendors scored`, after: { status: 'scored', scoring_run: 1 }, meta: { rfp_id: storage }, at: ago(8, 12) })
  log({ actorId: pm, type: 'rfp_vendor_entry', id: summitStorage.entry, action: 'vendor.shortlisted', text: `Summit Data Systems shortlisted for "${RFPS.storage.title}"`, before: { status: 'under_review' }, after: { status: 'shortlisted' }, meta: { rfp_id: storage, vendor_account_id: vendor.summit }, at: ago(7, 15) })
  log({ actorId: pm, type: 'evaluation', id: evaluation, action: 'report.generated', text: `Comparison report generated for "${RFPS.storage.title}"`, after: { status: 'report_generated' }, meta: { rfp_id: storage }, at: ago(6, 10) })
  if (liability) log({ actorId: pm, type: 'compliance_flag', id: liability.id, action: 'compliance_flag.escalated', text: 'High risk "Liability limitation" escalated (Harborline-Cloud-Storage-Proposal.pdf)', before: { status: 'open' }, after: { status: 'escalated' }, meta: { rfp_id: storage, vendor_account_id: vendor.harborline }, at: ago(4, 15) })

  must(await db.from('report_comments').insert({ org_id: org, rfp_id: storage, author_id: dh, body: 'Engineering supports Summit Data Systems. The 6-week migration fits our release calendar, and 24/7 support matters for the design teams working across time zones.', created_at: ago(5, 9) }), 'comment')
  log({ actorId: dh, type: 'rfp', id: storage, action: 'report.comment_added', text: `Department head commented on the "${RFPS.storage.title}" report`, meta: { rfp_id: storage }, at: ago(5, 9) })
  const note = must(await db.from('vendor_notes').insert({ org_id: org, rfp_vendor_entry_id: harborStorage.entry, author_id: pm, body: 'Called Taylor Brooks: Harborline can offer 24/7 support for USD 9,600 a year but would not move on upfront payment or the liability cap.', created_at: ago(5, 13) }).select('id').single(), 'note').id
  log({ actorId: pm, type: 'rfp_vendor_entry', id: harborStorage.entry, action: 'vendor.note_added', text: `Internal note added on a vendor for "${RFPS.storage.title}"`, meta: { rfp_id: storage, vendor_account_id: vendor.harborline, note_id: note }, at: ago(5, 13) })

  const submittedAt = ago(1, 10)
  const approval = must(await db.from('approval_requests').insert({ org_id: org, rfp_id: storage, vendor_account_id: vendor.summit, evaluation_id: evaluation, submitted_by: pm, submitted_to: fa, sla_due_at: addBusinessDays(submittedAt, 3), created_at: submittedAt }).select('id').single(), 'approval').id
  log({ actorId: pm, type: 'approval_request', id: approval, action: 'approval.submitted', text: `Summit Data Systems submitted for approval on "${RFPS.storage.title}" (to ${faA.fullName})`, after: { status: 'pending' }, meta: { rfp_id: storage, vendor_account_id: vendor.summit }, at: submittedAt })
  log({ actorId: pm, type: 'rfp', id: storage, action: 'rfp.status_changed', text: `"${RFPS.storage.title}" moved to Approval Pending`, before: { status: 'shortlisted' }, after: { status: 'approval_pending' }, meta: { rfp_id: storage }, at: submittedAt })

  // ── RFP 2: Endpoint Security — one proposal in, ready for evaluation (live AI scoring) ──
  const endpoint = await insertRfp({ title: RFPS.endpoint.title, description: RFPS.endpoint.description, department: RFPS.endpoint.department, budget_min: RFPS.endpoint.budgetMin, budget_max: RFPS.endpoint.budgetMax, submission_deadline: inDays(6), status: 'submissions_in', created_at: ago(13) })
  log({ actorId: pm, type: 'rfp', id: endpoint, action: 'rfp.created', text: `RFP "${RFPS.endpoint.title}" created`, after: { status: 'rfp_created' }, meta: { rfp_id: endpoint }, at: ago(13) })
  await submitVendor(endpoint, 'clearpath', { entryStatus: 'submitted', submittedDaysAgo: 3, rfpTitle: RFPS.endpoint.title })
  const harborEndpoint = must(await db.from('rfp_vendor_entries').insert({ org_id: org, rfp_id: endpoint, vendor_account_id: vendor.harborline, status: 'invited', created_at: ago(9) }).select('id').single(), 'entry').id
  must(await db.from('vendor_invites').insert({ org_id: org, rfp_id: endpoint, vendor_account_id: vendor.harborline, invited_by: pm, token: randomBytes(32).toString('hex'), status: 'accepted', expires_at: ago(6), accepted_at: ago(8), created_at: ago(9) }), 'invite')
  log({ actorId: pm, type: 'rfp_vendor_entry', id: harborEndpoint, action: 'vendor.invited', text: `Harborline Cloud Services invited to "${RFPS.endpoint.title}"`, after: { status: 'invited' }, meta: { rfp_id: endpoint, vendor_account_id: vendor.harborline }, at: ago(9, 11) })

  // ── RFP 3: Data Backup & DR — vendors invited, proposals not yet in (vendor portal demo) ──
  const backup = await insertRfp({ title: 'Data Backup and Disaster Recovery', description: 'Off-site backup and disaster recovery for 40 production servers and 12 databases: 4-hour recovery time objective, 1-hour recovery point objective, quarterly recovery tests and EU data residency.', department: 'IT Operations', budget_min: 45000, budget_max: 70000, submission_deadline: inDays(14), status: 'vendors_invited', created_at: ago(5) })
  log({ actorId: pm, type: 'rfp', id: backup, action: 'rfp.created', text: 'RFP "Data Backup and Disaster Recovery" created', after: { status: 'rfp_created' }, meta: { rfp_id: backup }, at: ago(5) })
  for (const key of ['harborline', 'summit']) {
    const entry = must(await db.from('rfp_vendor_entries').insert({ org_id: org, rfp_id: backup, vendor_account_id: vendor[key], status: 'invited', created_at: ago(4) }).select('id').single(), 'entry').id
    must(await db.from('vendor_invites').insert({ org_id: org, rfp_id: backup, vendor_account_id: vendor[key], invited_by: pm, token: randomBytes(32).toString('hex'), status: 'accepted', expires_at: ago(1), accepted_at: ago(3), created_at: ago(4) }), 'invite')
    log({ actorId: pm, type: 'rfp_vendor_entry', id: entry, action: 'vendor.invited', text: `${vendorName[key]} invited to "Data Backup and Disaster Recovery"`, after: { status: 'invited' }, meta: { rfp_id: backup, vendor_account_id: vendor[key] }, at: ago(4, 11) })
  }

  // ── RFP 4: Network Equipment Refresh — just created ──
  const network = await insertRfp({ title: 'Network Equipment Refresh', description: 'Replacement of core and access switches across three sites (about 60 devices), with installation, 5-year hardware support and a managed monitoring option.', department: 'IT Operations', budget_min: 150000, budget_max: 210000, submission_deadline: inDays(30), status: 'rfp_created', created_at: ago(1, 15) })
  log({ actorId: pm, type: 'rfp', id: network, action: 'rfp.created', text: 'RFP "Network Equipment Refresh" created', after: { status: 'rfp_created' }, meta: { rfp_id: network }, at: ago(1, 15) })

  // ── RFPs 5 and 6: earlier cycles that ended in contracts (one now near renewal) ──
  async function pastContract({ title, description, department, key, value, terms, startDaysAgo, endInDays, alertDays, createdDaysAgo }) {
    const rfp = await insertRfp({ title, description, department, budget_min: value * 0.8, budget_max: value * 1.2, status: 'approval_pending', created_at: ago(createdDaysAgo) })
    const entry = must(await db.from('rfp_vendor_entries').insert({ org_id: org, rfp_id: rfp, vendor_account_id: vendor[key], status: 'shortlisted', is_shortlisted: true, created_at: ago(createdDaysAgo - 2) }).select('id').single(), 'entry').id
    must(await db.from('submissions').insert({ org_id: org, rfp_id: rfp, vendor_account_id: vendor[key], rfp_vendor_entry_id: entry, status: 'under_review', submitted_at: ago(createdDaysAgo - 10), created_at: ago(createdDaysAgo - 12) }), 'submission')
    const evalId = must(await db.from('evaluations').select('id').eq('rfp_id', rfp).single(), 'evaluation').id
    must(await db.from('evaluations').update({ status: 'report_generated', report_generated_at: ago(createdDaysAgo - 20), report_executive_summary: `${vendorName[key]} met the requirements at a competitive price.`, report_recommendation: JSON.stringify({ vendor_account_id: vendor[key], rationale: 'Best overall value and terms.' }) }).eq('id', evalId), 'eval')
    const decidedAt = ago(startDaysAgo + 1)
    const req = must(await db.from('approval_requests').insert({ org_id: org, rfp_id: rfp, vendor_account_id: vendor[key], evaluation_id: evalId, submitted_by: pm, submitted_to: fa, sla_due_at: decidedAt, created_at: ago(startDaysAgo + 3) }).select('id').single(), 'approval').id
    // pending → approved fires the Schema §6.4 trigger: contract created, vendor Contracted.
    must(await db.from('approval_requests').update({ status: 'approved', decision_comment: 'Within budget; terms reviewed.', decided_by: fa, decided_at: decidedAt }).eq('id', req), 'approve')
    must(await db.from('rfps').update({ status: 'contracted' }).eq('id', rfp), 'contracted')
    const contract = must(await db.from('contracts').select('id').eq('approval_request_id', req).single(), 'contract').id
    must(await db.from('contracts').update({ title: `${title} — Contract`, value, payment_terms: terms, start_date: new Date(Date.now() - startDaysAgo * DAY).toISOString().slice(0, 10), end_date: dateIn(endInDays), alert_days: alertDays, status: endInDays <= alertDays ? 'expiring_soon' : 'active', created_at: decidedAt }).eq('id', contract), 'contract terms')
    log({ actorId: fa, type: 'approval_request', id: req, action: 'approval.approved', text: `${vendorName[key]} approved for "${title}"`, before: { status: 'pending' }, after: { status: 'approved' }, meta: { rfp_id: rfp, vendor_account_id: vendor[key] }, at: decidedAt })
    log({ actorId: fa, type: 'contract', id: contract, action: 'contract.created', text: `Contract "${title} — Contract" created with ${vendorName[key]}`, after: { status: 'active' }, meta: { rfp_id: rfp, vendor_account_id: vendor[key], contract_id: contract }, at: decidedAt })
    return contract
  }
  await pastContract({ title: 'Email Security Gateway', description: 'Cloud email filtering for 900 mailboxes.', department: 'IT Security', key: 'clearpath', value: 42000, terms: 'Annually in advance, net 30.', startDaysAgo: 270, endInDays: 460, alertDays: 90, createdDaysAgo: 320 })
  const renewal = await pastContract({ title: 'Cloud Backup Service', description: 'Managed backup of SaaS applications and endpoints.', department: 'IT Operations', key: 'harborline', value: 36000, terms: 'Quarterly in advance.', startDaysAgo: 337, endInDays: 28, alertDays: 60, createdDaysAgo: 380 })
  log({ type: 'contract', id: renewal, action: 'contract.renewal_alert', text: 'Renewal alert: "Cloud Backup Service — Contract" ends in 28 days', after: { status: 'expiring_soon', days_remaining: 28 }, meta: { contract_id: renewal }, at: ago(0, 8) })

  // ── Scoring template, notifications, activity ──
  must(await db.from('scoring_templates').insert({ org_id: org, created_by: pm, name: 'IT services — standard', criteria: [
    { name: 'Commercial value', description: 'Total cost, payment terms and price protection.', weight: 30, sort_order: 0 },
    { name: 'Service levels and support', description: 'Availability, response times, service credits.', weight: 25, sort_order: 1 },
    { name: 'Security and compliance', description: 'Certifications, data residency, breach notification.', weight: 25, sort_order: 2 },
    { name: 'Implementation', description: 'Timeline, resourcing and migration approach.', weight: 20, sort_order: 3 },
  ], last_used_at: ago(30), created_at: ago(60) }), 'template')

  const note_ = (recipient, type, title, body, entityType, entityId, at, read = false) => ({ org_id: org, recipient_id: recipient, type, title, body, entity_type: entityType, entity_id: entityId, created_at: at, is_read: read, read_at: read ? at : null })
  must(await db.from('notifications').insert([
    note_(pm, 'requirement_submitted', 'New requirement submitted', 'Laptops for new engineering hires', 'requirement', reqLaptops, ago(2, 14)),
    note_(pm, 'vendor_submitted', 'ClearPath Security submitted a proposal', `For "${RFPS.endpoint.title}"`, 'rfp', endpoint, ago(3, 16)),
    note_(pm, 'renewal_alert', 'Contract expiring in 28 days', 'Cloud Backup Service — Contract', 'contract', renewal, ago(0, 8)),
    note_(pm, 'scoring_complete', `Scoring complete for "${RFPS.storage.title}"`, '2 vendors scored.', 'rfp', storage, ago(8, 12), true),
    note_(fa, 'approval_requested', 'Approval requested', `Summit Data Systems for "${RFPS.storage.title}"`, 'approval_request', approval, submittedAt),
    note_(dh, 'evaluation_ready', 'Vendor evaluation ready', `The comparison report for "${RFPS.storage.title}" is ready.`, 'report', storage, ago(6, 10)),
  ]), 'notifications')
  must(await db.from('activity_log').insert(activity), 'activity')

  return { org, rfps: 6, activity: activity.length }
}

async function main() {
  const existing = await findUserId(ACCOUNTS.internal[0].email)
  if (existing && !args.has('--reset')) {
    console.log('The demo organisation already exists. Run `npm run demo:reset` to reload it.')
    return
  }
  if (args.has('--reset')) {
    await removeDemo()
    console.log('Previous demo organisation removed.')
  }
  const result = await load()
  console.log(`Loaded "${ACCOUNTS.organisation}" (${result.rfps} RFPs, ${result.activity} activity entries) into ${isLocal ? 'the local' : 'the hosted'} Supabase.`)
  console.log(`Sign in with any demo account — password: ${ACCOUNTS.password}`)
  for (const a of [...ACCOUNTS.internal, ...ACCOUNTS.vendors]) console.log(`  ${a.label.padEnd(36)} ${a.email}`)
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})
