import { NextResponse } from 'next/server'

import { apiError, requireUser, withErrors } from '@/lib/api'
import { AiError, generateJson } from '@/lib/gemini/client'
import { CRITERIA_SUGGESTION_PROMPT } from '@/lib/gemini/prompts'
import { EVALUATION_LOCKED, evaluationLockedMessage } from '@/lib/processing/locks'
import { criteriaSuggestionSchema } from '@/lib/schemas/ai'

export const maxDuration = 300

type Params = { params: Promise<{ rfpId: string }> }

/** Round to 2 decimals and make the weights add up to exactly 100 (the largest absorbs the rest). */
function normaliseWeights<T extends { weight: number }>(items: T[]): T[] {
  const sum = items.reduce((s, c) => s + c.weight, 0)
  if (sum <= 0) {
    const even = items.map((c) => ({ ...c, weight: Math.floor(10_000 / items.length) / 100 }))
    even[0]!.weight = Math.round((100 - even.slice(1).reduce((s, c) => s + c.weight, 0)) * 100) / 100
    return even
  }
  const scaled = items.map((c) => ({ ...c, weight: Math.max(0.01, Math.round((c.weight / sum) * 10_000) / 100) }))
  const diff = Math.round((100 - scaled.reduce((s, c) => s + c.weight, 0)) * 100) / 100
  const largest = scaled.reduce((best, c, i) => (c.weight > scaled[best]!.weight ? i : best), 0)
  scaled[largest]!.weight = Math.round((scaled[largest]!.weight + diff) * 100) / 100
  return scaled
}

// POST /api/process/suggest-criteria/[rfpId] — Backend Schema §8.4, PRD §5.3.3: 5–10 weighted
// criteria from the RFP and what the submitted proposals cover. Returned for the PM to edit;
// nothing is saved until PUT /api/evaluations/[rfpId]/criteria.
export const POST = withErrors(async function POST(_request: Request, { params }: Params) {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response
  const { rfpId } = await params

  const { data: rfp } = await auth.supabase.from('rfps').select('id, title, description, department, status').eq('id', rfpId).eq('is_deleted', false).maybeSingle()
  if (!rfp) return apiError(404, 'not_found', 'RFP not found.')
  if (EVALUATION_LOCKED.includes(rfp.status)) return apiError(409, 'locked', evaluationLockedMessage)

  const { data: docs } = await auth.supabase
    .from('documents')
    .select('raw_extraction, submissions!inner(rfp_id, vendor_account_id)')
    .eq('submissions.rfp_id', rfpId)
    .eq('extraction_status', 'extracted')
  if (!docs?.length) {
    return apiError(409, 'no_extracted_documents', 'No submitted documents have been processed yet. Wait for extraction to finish, then try again.')
  }

  // Extracted terms only, labelled "Vendor N" rather than by name: the criteria should follow
  // the RFP, not one vendor's pitch.
  const vendorNumbers = new Map<string, number>()
  const summaries = docs.map((d) => {
    const key = d.submissions.vendor_account_id
    if (!vendorNumbers.has(key)) vendorNumbers.set(key, vendorNumbers.size + 1)
    return `Vendor ${vendorNumbers.get(key)}: ${JSON.stringify(d.raw_extraction).slice(0, 6000)}`
  })

  try {
    const result = await generateJson({
      task: 'criteria',
      system: CRITERIA_SUGGESTION_PROMPT.system,
      prompt: CRITERIA_SUGGESTION_PROMPT.build(rfp, summaries.join('\n')),
      jsonSchema: CRITERIA_SUGGESTION_PROMPT.jsonSchema,
      schema: criteriaSuggestionSchema,
    })
    const criteria = normaliseWeights(result.criteria).map((c) => ({ name: c.name, description: c.description, weight: c.weight, isAiSuggested: true }))
    await auth.supabase.from('evaluations').update({ status: 'criteria_pending' }).eq('rfp_id', rfpId).eq('status', 'not_started')
    return NextResponse.json({ criteria })
  } catch (err) {
    console.error('suggest-criteria failed', err)
    return apiError(502, 'ai_failed', err instanceof AiError ? err.message : 'The AI could not suggest criteria. Please retry.')
  }
})
