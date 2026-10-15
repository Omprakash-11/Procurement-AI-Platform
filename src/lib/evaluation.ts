import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database, Enums } from '@/types'

// Evaluation + comparison-report read model (Backend Schema §2.10–2.13, §8.5). Callers pass
// the signed-in user's client (RLS: can_read_rfp / can_read_evaluation) — or, for the public
// share page and the PDF export, the service-role client after their own access check.

type Client = SupabaseClient<Database>

/** Vendors that take part in scoring: submitted and not dropped. */
export const EVALUATED_STATUSES: Enums<'vendor_pipeline_status'>[] = ['submitted', 'under_review', 'shortlisted', 'approved', 'contracted']

export type CriterionView = {
  id: string
  name: string
  description: string | null
  weight: number
  sortOrder: number
  isAiSuggested: boolean
}

export type ScoreView = {
  id: string
  criterionId: string
  aiScore: number | null
  aiReasoning: string | null
  overrideScore: number | null
  overrideJustification: string | null
  overriddenAt: string | null
  effectiveScore: number | null
}

export type VendorEvaluation = {
  vendorAccountId: string
  entryId: string
  companyName: string
  status: Enums<'vendor_pipeline_status'>
  scores: ScoreView[]
  /** Σ(effective score × weight %) on 0–10, once every criterion has a score. */
  total: number | null
}

export type Recommendation = { vendorAccountId: string | null; vendorName: string | null; rationale: string }

export type EvaluationView = {
  id: string
  rfpId: string
  status: Enums<'evaluation_status'>
  criteriaConfirmedAt: string | null
  scoringRunCount: number
  lastScoredAt: string | null
  reportGeneratedAt: string | null
  executiveSummary: string | null
  recommendation: Recommendation | null
  criteria: CriterionView[]
  vendors: VendorEvaluation[]
}

/** report_recommendation holds {"vendor_account_id", "rationale"} as text. */
export function encodeRecommendation(vendorAccountId: string | null, rationale: string): string {
  return JSON.stringify({ vendor_account_id: vendorAccountId, rationale })
}

function decodeRecommendation(raw: string | null, names: Map<string, string>): Recommendation | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { vendor_account_id?: unknown; rationale?: unknown }
    const id = typeof parsed.vendor_account_id === 'string' ? parsed.vendor_account_id : null
    return { vendorAccountId: id, vendorName: id ? (names.get(id) ?? null) : null, rationale: typeof parsed.rationale === 'string' ? parsed.rationale : '' }
  } catch {
    return { vendorAccountId: null, vendorName: null, rationale: raw }
  }
}

export function weightedTotal(criteria: CriterionView[], scores: ScoreView[]): number | null {
  if (criteria.length === 0) return null
  let total = 0
  for (const c of criteria) {
    const s = scores.find((x) => x.criterionId === c.id)?.effectiveScore
    if (s === null || s === undefined) return null
    total += (s * c.weight) / 100
  }
  return Math.round(total * 100) / 100
}

export async function loadEvaluation(client: Client, rfpId: string): Promise<EvaluationView | null> {
  const { data: evaluation } = await client
    .from('evaluations')
    .select('id, rfp_id, status, criteria_confirmed_at, scoring_run_count, last_scored_at, report_generated_at, report_executive_summary, report_recommendation')
    .eq('rfp_id', rfpId)
    .maybeSingle()
  if (!evaluation) return null

  const [{ data: criteriaRows }, { data: entries }, { data: scoreRows }] = await Promise.all([
    client.from('evaluation_criteria').select('id, name, description, weight, sort_order, is_ai_suggested').eq('evaluation_id', evaluation.id).order('sort_order'),
    client
      .from('rfp_vendor_entries')
      .select('id, status, vendor_account_id, vendor_accounts(company_name)')
      .eq('rfp_id', rfpId)
      .in('status', EVALUATED_STATUSES)
      .order('created_at'),
    client
      .from('vendor_scores')
      .select('id, criterion_id, vendor_account_id, ai_score, ai_reasoning, override_score, override_justification, overridden_at, effective_score')
      .eq('evaluation_id', evaluation.id)
      .eq('scoring_run', evaluation.scoring_run_count),
  ])

  const criteria: CriterionView[] = (criteriaRows ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    weight: Number(c.weight),
    sortOrder: c.sort_order,
    isAiSuggested: c.is_ai_suggested,
  }))
  const num = (v: number | null) => (v === null ? null : Number(v))

  const vendors: VendorEvaluation[] = (entries ?? []).map((e) => {
    const scores: ScoreView[] = (scoreRows ?? [])
      .filter((s) => s.vendor_account_id === e.vendor_account_id)
      .map((s) => ({
        id: s.id,
        criterionId: s.criterion_id,
        aiScore: num(s.ai_score),
        aiReasoning: s.ai_reasoning,
        overrideScore: num(s.override_score),
        overrideJustification: s.override_justification,
        overriddenAt: s.overridden_at,
        effectiveScore: num(s.effective_score),
      }))
    return {
      vendorAccountId: e.vendor_account_id,
      entryId: e.id,
      companyName: e.vendor_accounts?.company_name ?? 'Vendor',
      status: e.status,
      scores,
      total: weightedTotal(criteria, scores),
    }
  })

  const names = new Map(vendors.map((v) => [v.vendorAccountId, v.companyName]))
  return {
    id: evaluation.id,
    rfpId: evaluation.rfp_id,
    status: evaluation.status,
    criteriaConfirmedAt: evaluation.criteria_confirmed_at,
    scoringRunCount: evaluation.scoring_run_count,
    lastScoredAt: evaluation.last_scored_at,
    reportGeneratedAt: evaluation.report_generated_at,
    executiveSummary: evaluation.report_executive_summary,
    recommendation: decodeRecommendation(evaluation.report_recommendation, names),
    criteria,
    vendors,
  }
}

// ── Comparison report (App Flow §4, PRD §5.5) ───────────────────────────────

export type FlagCounts = { high: number; medium: number; low: number }
export type KeyTerms = { pricing: string | null; paymentTerms: string | null; delivery: string | null; sla: string | null }

export type ReportVendor = VendorEvaluation & { rank: number | null; flags: FlagCounts; keyTerms: KeyTerms }

export type ReportView = {
  rfp: { id: string; title: string; department: string; description: string }
  orgName: string
  evaluation: EvaluationView
  vendors: ReportVendor[]
}

export async function loadReport(client: Client, rfpId: string): Promise<ReportView | null> {
  const { data: rfp } = await client
    .from('rfps')
    .select('id, title, department, description, organisations(name)')
    .eq('id', rfpId)
    .eq('is_deleted', false)
    .maybeSingle()
  if (!rfp) return null
  const evaluation = await loadEvaluation(client, rfpId)
  if (!evaluation) return null

  const { data: submissions } = await client
    .from('submissions')
    .select('vendor_account_id, status, documents(extraction_status, extracted_pricing, extracted_payment_terms, extracted_delivery, extracted_sla, created_at, compliance_flags(severity))')
    .eq('rfp_id', rfpId)
    .neq('status', 'in_progress')

  const ranked = [...evaluation.vendors].filter((v) => v.total !== null).sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
  const vendors: ReportVendor[] = evaluation.vendors.map((v) => {
    const docs = [...(submissions?.find((s) => s.vendor_account_id === v.vendorAccountId)?.documents ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at))
    const flags: FlagCounts = { high: 0, medium: 0, low: 0 }
    for (const d of docs) for (const f of d.compliance_flags) flags[f.severity] += 1
    const extracted = docs.filter((d) => d.extraction_status === 'extracted')
    const first = (pick: (d: (typeof extracted)[number]) => string | null) => extracted.map(pick).find((x) => x) ?? null
    return {
      ...v,
      rank: v.total === null ? null : ranked.findIndex((r) => r.vendorAccountId === v.vendorAccountId) + 1,
      flags,
      keyTerms: {
        pricing: first((d) => d.extracted_pricing),
        paymentTerms: first((d) => d.extracted_payment_terms),
        delivery: first((d) => d.extracted_delivery),
        sla: first((d) => d.extracted_sla),
      },
    }
  })

  return {
    rfp: { id: rfp.id, title: rfp.title, department: rfp.department, description: rfp.description },
    orgName: rfp.organisations?.name ?? '',
    evaluation,
    vendors,
  }
}
