import { logActivity } from '@/lib/activity'
import { EVALUATED_STATUSES } from '@/lib/evaluation'
import { AiError, generateJson } from '@/lib/gemini/client'
import { SCORING_PROMPT } from '@/lib/gemini/prompts'
import { loadDocumentText } from '@/lib/processing/documents'
import { findPm, notify } from '@/lib/processing/notify'
import { scoringSchema } from '@/lib/schemas/ai'
import { createAdminClient } from '@/lib/supabase/server'

// PRD §5.3.3 / Backend Schema §8.4 score route. Runs inside waitUntil with the service role
// after the PM-authenticated route has set the evaluation to scoring_in_progress.

/** An evaluation stuck in scoring this long (killed function) may be re-run. */
export const STALE_SCORING_MS = 10 * 60_000

/** Per-vendor cap on proposal text sent to the model (≈ 150k tokens). */
const VENDOR_MATERIAL_CHARS = 600_000

type ScoreInput = { evaluationId: string; run: number; vendorAccountIds?: string[] }

async function vendorMaterial(rfpId: string, vendorAccountId: string): Promise<string | null> {
  const { data: docs } = await createAdminClient()
    .from('documents')
    .select('file_name, file_type, storage_path, raw_extraction, submissions!inner(rfp_id, vendor_account_id, status)')
    .eq('submissions.rfp_id', rfpId)
    .eq('submissions.vendor_account_id', vendorAccountId)
    .neq('submissions.status', 'in_progress')
    .eq('extraction_status', 'extracted')
    .order('created_at')
  if (!docs?.length) return null
  const perDoc = Math.floor(VENDOR_MATERIAL_CHARS / docs.length)
  const parts: string[] = []
  for (const d of docs) {
    let text = ''
    try {
      text = await loadDocumentText(d.storage_path, d.file_type)
    } catch {
      text = '(document text unavailable — use the extracted terms)'
    }
    parts.push(`### File: ${d.file_name}\nExtracted terms (JSON): ${JSON.stringify(d.raw_extraction)}\nDocument text:\n${text.slice(0, perDoc)}`)
  }
  return parts.join('\n\n')
}

/** Score one vendor for one run. Returns false on failure (the Scores tab offers Retry). */
async function scoreVendor(ctx: { evaluationId: string; orgId: string; rfp: { id: string; title: string; description: string } }, criteria: { id: string; name: string; description: string | null; weight: number }[], vendorAccountId: string, run: number): Promise<boolean> {
  try {
    const material = await vendorMaterial(ctx.rfp.id, vendorAccountId)
    if (!material) return false
    const result = await generateJson({
      task: 'scoring',
      system: SCORING_PROMPT.system,
      prompt: SCORING_PROMPT.build(ctx.rfp, criteria, material),
      jsonSchema: SCORING_PROMPT.jsonSchema,
      schema: scoringSchema,
    })
    const byCriterion = new Map(result.scores.map((s) => [s.criterion_id, s]))
    if (criteria.some((c) => !byCriterion.has(c.id))) throw new AiError('The AI did not score every criterion.')

    const admin = createAdminClient()
    await admin.from('vendor_scores').delete().eq('evaluation_id', ctx.evaluationId).eq('vendor_account_id', vendorAccountId).eq('scoring_run', run)
    const now = new Date().toISOString()
    const { error } = await admin.from('vendor_scores').insert(
      criteria.map((c) => {
        const s = byCriterion.get(c.id)!
        return {
          org_id: ctx.orgId,
          evaluation_id: ctx.evaluationId,
          criterion_id: c.id,
          vendor_account_id: vendorAccountId,
          scoring_run: run,
          ai_score: Math.round(s.score * 100) / 100,
          ai_reasoning: s.reasoning,
          ai_scored_at: now,
        }
      })
    )
    if (error) throw new Error(`Saving scores failed: ${error.message}`)
    return true
  } catch (err) {
    console.error('scoreVendor failed', vendorAccountId, err)
    return false
  }
}

export async function scoreEvaluation({ evaluationId, run, vendorAccountIds }: ScoreInput): Promise<void> {
  const admin = createAdminClient()
  const { data: evaluation } = await admin.from('evaluations').select('id, org_id, rfp_id, rfps!inner(title, description)').eq('id', evaluationId).single()
  if (!evaluation) return
  const { data: criteriaRows } = await admin.from('evaluation_criteria').select('id, name, description, weight').eq('evaluation_id', evaluationId).order('sort_order')
  const criteria = (criteriaRows ?? []).map((c) => ({ ...c, weight: Number(c.weight) }))

  let query = admin.from('rfp_vendor_entries').select('vendor_account_id, vendor_accounts(company_name)').eq('rfp_id', evaluation.rfp_id).in('status', EVALUATED_STATUSES)
  if (vendorAccountIds?.length) query = query.in('vendor_account_id', vendorAccountIds)
  const { data: vendors } = await query

  const ctx = { evaluationId, orgId: evaluation.org_id, rfp: { id: evaluation.rfp_id, title: evaluation.rfps.title, description: evaluation.rfps.description } }
  const outcomes = criteria.length
    ? await Promise.all((vendors ?? []).map(async (v) => ({ name: v.vendor_accounts?.company_name ?? 'Vendor', ok: await scoreVendor(ctx, criteria, v.vendor_account_id, run) })))
    : []
  const scored = outcomes.filter((o) => o.ok).length
  const failed = outcomes.filter((o) => !o.ok).map((o) => o.name)

  // Only finish the run this call belongs to (a newer re-score may have started meanwhile).
  const { data: finished } = await admin
    .from('evaluations')
    .update({ status: 'scored', last_scored_at: new Date().toISOString() })
    .eq('id', evaluationId)
    .eq('status', 'scoring_in_progress')
    .eq('scoring_run_count', run)
    .select('id')
  if (!finished?.length) return

  await logActivity({
    orgId: evaluation.org_id,
    actorId: null,
    actorType: 'system',
    entityType: 'evaluation',
    entityId: evaluationId,
    action: 'evaluation.scored',
    description: `Scoring completed for "${evaluation.rfps.title}" — ${scored} of ${outcomes.length} vendors scored${failed.length ? ` (failed: ${failed.join(', ')})` : ''}`,
    after: { status: 'scored', scoring_run: run, scored, failed },
    metadata: { rfp_id: evaluation.rfp_id },
  })
  // App Flow §4 / §8.3: "Scoring complete for [RFP name]" → PM, in-app.
  const pm = await findPm(evaluation.org_id)
  if (pm) {
    await notify({
      orgId: evaluation.org_id,
      recipientId: pm.id,
      type: 'scoring_complete',
      title: `Scoring complete for "${evaluation.rfps.title}"`,
      body: failed.length ? `${scored} of ${outcomes.length} vendors scored — retry the rest from their Scores tab.` : `${scored} ${scored === 1 ? 'vendor' : 'vendors'} scored.`,
      entityType: 'rfp',
      entityId: evaluation.rfp_id,
    })
  }
}
