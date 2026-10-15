import type { AiTask } from '@/lib/gemini/client'

// Decision P11-1 — E2E tests only (never on Vercel, never with a hosted Supabase: see
// testStandInEnabled in client.ts). A deterministic stand-in for Gemini that answers from the
// request's own material, so tests behave like real use: fields are quoted from the uploaded
// proposal, risky clauses are flagged with their exact wording, scores follow the evidence and
// the report compares the actual vendors. Every answer still passes the same Zod validation.

const FENCE = /<vendor_data_[0-9a-f]+>\n([\s\S]*?)\n<\/vendor_data_[0-9a-f]+>/

const fenced = (prompt: string) => FENCE.exec(prompt)?.[1] ?? ''

/** Sentences / lines of a document, whitespace-normalised. */
function sentences(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((line) => line.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+(?=[A-Z0-9])/))
    .map((s) => s.trim())
    .filter((s) => s.length > 3)
}

const clip = (s: string | undefined | null, n = 600) => (s ? (s.length > n ? `${s.slice(0, n - 1)}…` : s) : null)

function find(lines: string[], pattern: RegExp, also?: RegExp, exclude: Set<string> = new Set()): string | null {
  const hit = lines.find((l) => pattern.test(l) && (!also || also.test(l)) && !exclude.has(l))
  return hit ?? null
}

// ── Extraction ──────────────────────────────────────────────────────────────

function extraction(prompt: string) {
  const body = fenced(prompt)
  const text = body.replace(/^File name:.*\n\n/, '')
  const lines = sentences(text)
  const used = new Set<string>()
  const take = (pattern: RegExp, also?: RegExp) => {
    const hit = find(lines, pattern, also, used)
    if (hit) used.add(hit)
    return clip(hit)
  }
  const heading = lines[0] ?? ''
  const vendorFromHeading = heading.split(/\s[—–-]\s|\bproposal\b/i)[0]?.trim()
  const vendorFromSuffix = /([A-Z][\w&.]*(?:\s[A-Z][\w&.]*){0,3}\s(?:Ltd|Limited|Inc|LLC|GmbH|Services|Supplies|Solutions|Systems|Technologies)\b\.?)/.exec(text)?.[1]

  return {
    vendor_name: clip(vendorFromSuffix ?? vendorFromHeading ?? null, 200),
    contact_information: take(/[\w.+-]+@[\w-]+\.[\w.]+|\+\d[\d\s()-]{7,}/),
    company_overview: take(/\b(founded|established|employees|staff|customers|clients|years in business|headquartered)\b/i),
    pricing: take(/\b(total|price|fee|annual|per year|per month|cost)\b/i, /\d/),
    payment_terms: take(/\b(payment|payable|invoice|net \d+|in arrears|upfront|in advance|quarterly)\b/i),
    cost_breakdown: take(/\b(breakdown|storage|support|onboarding|licen[cs]e|implementation fee)\b/i, /\d.*\d/),
    delivery_timeline: take(/\b(weeks?|months?|deliver|migration|implementation|go-live|timeline|milestone)\b/i),
    sla: take(/\b(availability|uptime|SLA|service level|response time|service credits?)\b/i),
    warranty_liability: take(/\b(liabilit\w*|warrant\w*|indemn\w*)\b/i),
    termination: take(/\b(terminat\w*|renew\w*|notice|cancel\w*)\b/i),
    data_privacy: take(/\b(GDPR|privacy|breach|residency|ISO 27001|SOC 2|encrypt\w*|data cent(er|re)s?)\b/i),
    differentiators: take(/\b(certified|award|dedicated|24\/7|proprietary|unique|specialist)\b/i),
  }
}

// ── Compliance ──────────────────────────────────────────────────────────────

type Flag = { flag_type: string; severity: 'high' | 'medium' | 'low'; clause_text: string | null; explanation: string }

const RULES: { type: string; pattern: RegExp; severity: (clause: string) => Flag['severity'] | null; explanation: string }[] = [
  {
    type: 'payment_terms',
    pattern: /(100%|full|entire|whole)[^.]{0,60}(upfront|up-front|in advance)|payable (upfront|in advance)/i,
    severity: () => 'high',
    explanation: 'Paying the full fee in advance removes the buyer\'s leverage if delivery or service quality falls short.',
  },
  {
    type: 'auto_renewal',
    pattern: /renews? automatically|automatic(ally)? renew|auto-renew/i,
    severity: (c) => {
      const days = Number(/(\d+)\s*days?/i.exec(c)?.[1] ?? '90')
      return days <= 30 ? 'high' : 'medium'
    },
    explanation: 'The contract renews automatically with a short opt-out window, so the buyer could be locked into a further term without a decision.',
  },
  {
    type: 'price_escalation',
    pattern: /(increase|adjust|raise)[^.]{0,80}(discretion|without (any )?(limit|cap))|without limit/i,
    severity: () => 'high',
    explanation: 'Prices can rise at the provider\'s discretion with no cap, making future costs unpredictable.',
  },
  {
    type: 'liability_limitation',
    pattern: /liabilit\w*[^.]{0,80}(unlimited for the (customer|client|buyer)|capped at (USD|EUR|GBP|INR|\$|€|£)?\s?[\d,]{1,6}\b(?!\s*(months|%)))/i,
    severity: () => 'high',
    explanation: 'Liability is heavily one-sided: the provider\'s exposure is capped at a token amount while the buyer\'s is not.',
  },
  {
    type: 'unilateral_modification',
    pattern: /may (amend|modify|change|update) (these|the|its) terms|at any time by (posting|publishing)/i,
    severity: () => 'high',
    explanation: 'The provider can change the terms on its own, so commitments made in the proposal may not hold.',
  },
  {
    type: 'data_breach_notification',
    pattern: /no (commitment|obligation)[^.]{0,80}breach|breach[^.]{0,40}(not (be )?notif|no notification)/i,
    severity: () => 'high',
    explanation: 'There is no obligation to notify the buyer of a data breach, which conflicts with data-protection expectations.',
  },
  {
    type: 'penalty_clause',
    pattern: /\bpenalt(y|ies)\b|liquidated damages/i,
    severity: () => 'medium',
    explanation: 'Penalty terms should be checked for proportionality to the contract value.',
  },
  {
    type: 'fee_structure',
    pattern: /(additional|hidden|ancillary|extra) (fees|charges)|surcharge|excludes[^.]{0,40}(fees|costs)/i,
    severity: () => 'medium',
    explanation: 'Some costs sit outside the headline price; the total cost of ownership may be higher than quoted.',
  },
  {
    type: 'ip_ownership',
    pattern: /(intellectual property|\bIP\b|deliverables)[^.]{0,60}(remain|retain\w*|owned by|property of) (the )?(provider|vendor|supplier)/i,
    severity: () => 'medium',
    explanation: 'Custom deliverables would remain the provider\'s property; the buyer may need a licence to keep using them.',
  },
  {
    type: 'jurisdiction',
    pattern: /governed by the laws of/i,
    severity: () => 'low',
    explanation: 'Confirm the governing law matches the buyer\'s jurisdiction before signing.',
  },
]

function compliance(prompt: string) {
  const lines = sentences(fenced(prompt))
  const flags: Flag[] = []
  for (const rule of RULES) {
    const clause = lines.find((l) => rule.pattern.test(l))
    if (!clause) continue
    const severity = rule.severity(clause)
    if (severity) flags.push({ flag_type: rule.type, severity, clause_text: clip(clause), explanation: rule.explanation })
  }
  return { flags }
}

// ── Criteria suggestion ─────────────────────────────────────────────────────

function criteria() {
  return {
    criteria: [
      { name: 'Commercial Value', description: 'Total cost, payment terms and price protection over the contract term.', weight: 25 },
      { name: 'Service Levels & Reliability', description: 'Committed availability, response times and service credits.', weight: 20 },
      { name: 'Security & Data Protection', description: 'Certifications, data residency and breach-notification commitments.', weight: 20 },
      { name: 'Contract & Legal Terms', description: 'Liability, renewal, termination and change-control terms.', weight: 15 },
      { name: 'Implementation Approach', description: 'Delivery timeline, milestones and project resourcing.', weight: 10 },
      { name: 'Vendor Stability & Experience', description: 'Track record, scale and relevant references.', weight: 10 },
    ],
  }
}

// ── Scoring ─────────────────────────────────────────────────────────────────

type Evidence = { delta: number; note: string }

function evidenceFor(name: string, text: string): Evidence[] {
  const t = text
  const ev: Evidence[] = []
  const has = (re: RegExp) => re.test(t)
  if (/commerc|price|cost|value/i.test(name)) {
    if (has(/(100%|full|entire)[^.]{0,60}(upfront|in advance)/i)) ev.push({ delta: -2.5, note: 'requires full payment upfront' })
    if (has(/(increase|adjust)[^.]{0,80}(discretion|without (limit|cap))|without limit/i)) ev.push({ delta: -1.5, note: 'allows uncapped price increases' })
    if (has(/in arrears|net (30|45|60)/i)) ev.push({ delta: 1, note: 'offers payment in arrears' })
    if (has(/capped at \d+(\.\d+)?% per year|increases? capped/i)) ev.push({ delta: 1, note: 'caps annual price increases' })
  } else if (/service|sla|reliab/i.test(name)) {
    const avail = Number(/(\d{2}(?:\.\d+)?)%\s*(monthly )?(availability|uptime)/i.exec(t)?.[1] ?? '0')
    if (avail >= 99.99) ev.push({ delta: 2.5, note: `commits to ${avail}% availability` })
    else if (avail >= 99.9) ev.push({ delta: 0.5, note: `commits to ${avail}% availability` })
    else if (avail > 0) ev.push({ delta: -1, note: `commits to only ${avail}% availability` })
    else ev.push({ delta: -1.5, note: 'gives no availability commitment' })
    if (has(/service credits? (of )?up to (2\d|3\d|[4-9]\d)%/i)) ev.push({ delta: 0.5, note: 'backs the SLA with meaningful service credits' })
    if (has(/\d+-hour response|response (time )?(within|of) \d+ hours?/i)) ev.push({ delta: 0.5, note: 'defines incident response times' })
  } else if (/secur|data|privacy|complian/i.test(name)) {
    if (has(/ISO 27001|SOC 2/i)) ev.push({ delta: 1.5, note: 'holds recognised security certification' })
    if (has(/GDPR/i)) ev.push({ delta: 0.5, note: 'states GDPR compliance' })
    if (has(/breach notification within \d+ hours|notif\w* within \d+ hours/i)) ev.push({ delta: 1, note: 'commits to timely breach notification' })
    if (has(/no (commitment|obligation)[^.]{0,80}breach/i)) ev.push({ delta: -3.5, note: 'makes no breach-notification commitment' })
  } else if (/contract|legal|terms|risk/i.test(name)) {
    if (has(/may (amend|modify|change) (these|the) terms|at any time by posting/i)) ev.push({ delta: -2, note: 'can change terms unilaterally' })
    if (has(/unlimited for the (customer|client|buyer)/i)) ev.push({ delta: -2.5, note: 'imposes one-sided liability' })
    if (has(/renews? automatically/i)) ev.push({ delta: -1, note: 'renews automatically with a short opt-out' })
    if (has(/mutual liability cap|cap of 12 months/i)) ev.push({ delta: 1.5, note: 'offers a balanced mutual liability cap' })
    if (has(/terminate for convenience/i)) ev.push({ delta: 1, note: 'allows termination for convenience' })
    if (has(/owned by the customer|customer owns/i)) ev.push({ delta: 0.5, note: 'assigns custom deliverables to the customer' })
  } else if (/implement|deliver|migrat|onboard|timeline/i.test(name)) {
    const weeks = Number(/(\d+)\s*weeks?/i.exec(t)?.[1] ?? '0')
    if (weeks && weeks <= 4) ev.push({ delta: 2, note: `plans delivery in ${weeks} weeks` })
    else if (weeks && weeks <= 8) ev.push({ delta: 0.5, note: `plans delivery in ${weeks} weeks` })
    else if (weeks) ev.push({ delta: -1, note: `needs ${weeks} weeks to deliver` })
    if (has(/dedicated project manager/i)) ev.push({ delta: 0.5, note: 'assigns a dedicated project manager' })
  } else if (/stabil|maturity|experience|track|vendor/i.test(name)) {
    const years = Number(/(\d+)\s*years in business/i.exec(t)?.[1] ?? '0')
    const founded = Number(/founded (?:in )?(\d{4})/i.exec(t)?.[1] ?? '0')
    const age = years || (founded ? new Date().getFullYear() - founded : 0)
    if (age >= 20) ev.push({ delta: 2, note: `has ${age} years of track record` })
    else if (age >= 10) ev.push({ delta: 1, note: `has ${age} years of track record` })
    if (has(/\b\d{2,} (staff|employees|customers)\b/i)) ev.push({ delta: 0.5, note: 'shows meaningful operating scale' })
  }
  return ev
}

function scoring(prompt: string) {
  const criteriaLine = prompt.split('\n').find((l) => l.startsWith('[{') && l.includes('criterion_id')) ?? '[]'
  const list = JSON.parse(criteriaLine) as { criterion_id: string; name: string }[]
  const material = fenced(prompt)
  return {
    scores: list.map((c) => {
      const ev = evidenceFor(c.name, material)
      const raw = 6.5 + ev.reduce((s, e) => s + e.delta, 0)
      const score = Math.min(10, Math.max(1, Math.round(raw * 2) / 2))
      const notes = ev.map((e) => e.note)
      const reasoning = notes.length
        ? `The proposal ${notes.slice(0, 3).join(', ')}${notes.length > 3 ? ', among other points' : ''}.`
        : 'The proposal gives little specific detail on this criterion, so it scores around the midpoint.'
      return { criterion_id: c.criterion_id, score, reasoning }
    }),
  }
}

// ── Report ──────────────────────────────────────────────────────────────────

type ReportVendor = { vendor_id: string; name: string; weighted_total: number; compliance_flags: { high: number; medium: number; low: number } }

function report(prompt: string) {
  let data: { criteria?: unknown[]; vendors?: ReportVendor[] } = {}
  try {
    data = JSON.parse(fenced(prompt))
  } catch {
    data = {}
  }
  const vendors = [...(data.vendors ?? [])].sort((a, b) => b.weighted_total - a.weighted_total)
  if (!vendors.length) {
    return { executive_summary: 'No vendor has been scored yet, so no comparison is possible.', recommended_vendor_id: null, recommendation_rationale: 'Score at least one vendor before generating the report.' }
  }
  const [top, second] = vendors
  // Prefer the runner-up only when the leader carries clearly more high risks and the gap is small.
  const pickSecond = second && top!.compliance_flags.high >= second.compliance_flags.high + 2 && top!.weighted_total - second.weighted_total < 1
  const pick = pickSecond ? second! : top!
  const other = pick === top ? second : top
  const flagsText = (v: ReportVendor) =>
    v.compliance_flags.high ? `${v.compliance_flags.high} high-severity compliance ${v.compliance_flags.high === 1 ? 'risk' : 'risks'}` : 'no high-severity compliance risks'
  const criteriaCount = data.criteria?.length ?? 0

  const summary = [
    `${vendors.length} ${vendors.length === 1 ? 'proposal was' : 'proposals were'} evaluated against ${criteriaCount} weighted criteria.`,
    `${top!.name} achieved the highest weighted score (${top!.weighted_total.toFixed(2)}/10)${second ? `, ahead of ${second.name} (${second.weighted_total.toFixed(2)}/10)` : ''}.`,
    `${pick.name} shows ${flagsText(pick)}${other ? `, while ${other.name} shows ${flagsText(other)}` : ''}.`,
    'Commercial terms, service commitments and contract risk were the main differentiators.',
    'This recommendation is advisory and should be confirmed by the procurement and finance teams.',
  ].join(' ')
  const rationale = pickSecond
    ? `${pick.name} is recommended despite a slightly lower score because ${top!.name} carries materially more high-severity contract risks. The score difference is small enough that the lower risk profile should take priority.`
    : `${pick.name} leads on the weighted criteria${other ? ` by ${(pick.weighted_total - other.weighted_total).toFixed(2)} points` : ''} and ${pick.compliance_flags.high ? 'its risks appear negotiable' : 'carries no high-severity risks'}. It offers the strongest overall balance of value, service and contract terms.`
  return { executive_summary: summary, recommended_vendor_id: pick.vendor_id, recommendation_rationale: rationale }
}

// ── Entry point ─────────────────────────────────────────────────────────────

export async function mockAnswer(task: AiTask, prompt: string): Promise<unknown> {
  // A short, size-dependent pause so status transitions (queued → processing → extracted) are
  // observable as they are with the real model.
  await new Promise((r) => setTimeout(r, Math.min(1500, 400 + prompt.length / 200)))
  switch (task) {
    case 'extraction':
      return extraction(prompt)
    case 'compliance':
      return compliance(prompt)
    case 'criteria':
      return criteria()
    case 'scoring':
      return scoring(prompt)
    case 'report':
      return report(prompt)
  }
}
