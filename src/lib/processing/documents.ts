import { logActivity } from '@/lib/activity'
import { extractText, ScannedDocumentError } from '@/lib/documents/extract-text'
import { AiError, generateJson } from '@/lib/gemini/client'
import { COMPLIANCE_PROMPT, EXTRACTION_PROMPT } from '@/lib/gemini/prompts'
import { findPm, notify } from '@/lib/processing/notify'
import { complianceSchema, extractionSchema, type Extraction } from '@/lib/schemas/ai'
import { createAdminClient } from '@/lib/supabase/server'
import { VENDOR_BUCKET } from '@/lib/vendor/storage'
import type { Enums, Json } from '@/types'

// Decision P7-4 / Tech Stack §11.1: a submitted document runs queued → processing →
// extracted | failed. One pass = text extraction → Gemini extraction → compliance check.
// Runs with the service role (inside waitUntil, after the triggering request has returned);
// every caller authenticates and checks the role first.

/** A document stuck in "processing" this long (killed function) may be retried. */
export const STALE_PROCESSING_MS = 6 * 60_000

const GENERIC_FAILURE = 'Extraction failed. Please retry.'

type DocContext = {
  id: string
  orgId: string
  submissionId: string
  fileName: string
  fileType: Enums<'document_type'>
  storagePath: string
  rfpId: string
  rfpTitle: string
  vendorAccountId: string
  vendorName: string
}

async function loadContext(documentId: string): Promise<DocContext | null> {
  const { data } = await createAdminClient()
    .from('documents')
    .select('id, org_id, submission_id, file_name, file_type, storage_path, submissions!inner(status, rfp_id, vendor_account_id, rfps!inner(title), vendor_accounts!inner(company_name))')
    .eq('id', documentId)
    .maybeSingle()
  if (!data || data.submissions.status === 'in_progress') return null
  return {
    id: data.id,
    orgId: data.org_id,
    submissionId: data.submission_id,
    fileName: data.file_name,
    fileType: data.file_type,
    storagePath: data.storage_path,
    rfpId: data.submissions.rfp_id,
    rfpTitle: data.submissions.rfps.title,
    vendorAccountId: data.submissions.vendor_account_id,
    vendorName: data.submissions.vendor_accounts.company_name,
  }
}

/** Download a stored vendor file and extract its text (throws ScannedDocumentError). */
export async function loadDocumentText(storagePath: string, fileType: Enums<'document_type'>): Promise<string> {
  const { data, error } = await createAdminClient().storage.from(VENDOR_BUCKET).download(storagePath)
  if (error || !data) throw new Error('The stored file could not be read.')
  return extractText(Buffer.from(await data.arrayBuffer()), fileType)
}

/**
 * Claim a document for processing: queued / failed (or stale processing) → processing.
 * Optimistic on (status, attempts) so two triggers can't both run it.
 */
export async function claimDocument(documentId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: doc } = await admin.from('documents').select('extraction_status, extraction_attempts, updated_at').eq('id', documentId).maybeSingle()
  if (!doc) return false
  const stale = doc.extraction_status === 'processing' && Date.now() - new Date(doc.updated_at).getTime() > STALE_PROCESSING_MS
  if (!['queued', 'failed'].includes(doc.extraction_status) && !stale) return false
  const { data: claimed } = await admin
    .from('documents')
    .update({ extraction_status: 'processing', extraction_error: null, extraction_attempts: doc.extraction_attempts + 1 })
    .eq('id', documentId)
    .eq('extraction_status', doc.extraction_status)
    .eq('extraction_attempts', doc.extraction_attempts)
    .select('id')
  return Boolean(claimed?.length)
}

async function buyerContext(orgId: string, rfpId: string): Promise<string> {
  const admin = createAdminClient()
  const [{ data: org }, { data: rfp }] = await Promise.all([
    admin.from('organisations').select('name, currency').eq('id', orgId).single(),
    admin.from('rfps').select('title, department, description, budget_min, budget_max').eq('id', rfpId).single(),
  ])
  const budget = rfp && (rfp.budget_min !== null || rfp.budget_max !== null) ? `budget ${rfp.budget_min ?? '?'}–${rfp.budget_max ?? '?'} ${org?.currency ?? ''}` : 'budget not stated'
  return `Buyer organisation "${org?.name ?? 'the buyer'}" (amounts in ${org?.currency ?? 'unknown currency'}). RFP "${rfp?.title ?? ''}" for the ${rfp?.department ?? ''} department, ${budget}. ${rfp?.description ?? ''}`.slice(0, 3000)
}

/**
 * Compliance check for one document (PRD §5.4). Re-runs replace the still-open flags; flags the
 * PM already acknowledged or escalated are kept and not raised again for the same flag type.
 */
export async function runCompliance(ctx: Pick<DocContext, 'id' | 'orgId' | 'rfpId' | 'fileName'>, text: string): Promise<number> {
  const result = await generateJson({
    task: 'compliance',
    system: COMPLIANCE_PROMPT.system,
    prompt: COMPLIANCE_PROMPT.build(text, await buyerContext(ctx.orgId, ctx.rfpId)),
    jsonSchema: COMPLIANCE_PROMPT.jsonSchema,
    schema: complianceSchema,
  })
  const admin = createAdminClient()
  const { data: kept } = await admin.from('compliance_flags').select('flag_type').eq('document_id', ctx.id).neq('status', 'open')
  const handled = new Set((kept ?? []).map((f) => f.flag_type))
  const fresh = result.flags.filter((f) => !handled.has(f.flag_type))

  const { error: delError } = await admin.from('compliance_flags').delete().eq('document_id', ctx.id).eq('status', 'open')
  if (delError) throw new Error('Saving compliance flags failed.')
  if (fresh.length) {
    const { error } = await admin.from('compliance_flags').insert(
      fresh.map((f) => ({
        org_id: ctx.orgId,
        document_id: ctx.id,
        flag_type: f.flag_type,
        severity: f.severity,
        clause_text: f.clause_text ? f.clause_text.slice(0, 2000) : null,
        explanation: f.explanation,
      }))
    )
    if (error) throw new Error('Saving compliance flags failed.')
  }
  return fresh.length
}

function promoted(e: Extraction) {
  return {
    extracted_vendor_name: e.vendor_name,
    extracted_pricing: e.pricing,
    extracted_payment_terms: e.payment_terms,
    extracted_delivery: e.delivery_timeline,
    extracted_sla: e.sla,
    extracted_warranty: e.warranty_liability,
    extracted_termination: e.termination,
    extracted_data_privacy: e.data_privacy,
  }
}

/**
 * Full pass for one document. Never throws — failures are stored on the row (inline Retry).
 * Pass alreadyClaimed when the caller ran claimDocument itself.
 */
export async function processDocument(documentId: string, alreadyClaimed = false): Promise<void> {
  const ctx = await loadContext(documentId)
  if (!ctx || (!alreadyClaimed && !(await claimDocument(documentId)))) return
  const admin = createAdminClient()

  try {
    const text = await loadDocumentText(ctx.storagePath, ctx.fileType)
    const extraction = await generateJson({
      task: 'extraction',
      system: EXTRACTION_PROMPT.system,
      prompt: EXTRACTION_PROMPT.build(text, ctx.fileName),
      jsonSchema: EXTRACTION_PROMPT.jsonSchema,
      schema: extractionSchema,
    })
    const { error: saveError } = await admin
      .from('documents')
      .update({ raw_extraction: extraction as unknown as Json, ...promoted(extraction) })
      .eq('id', ctx.id)
    if (saveError) throw new Error('Saving the extracted data failed.')

    const flagCount = await runCompliance(ctx, text)

    await admin.from('documents').update({ extraction_status: 'extracted', last_extracted_at: new Date().toISOString() }).eq('id', ctx.id)
    await logActivity({
      orgId: ctx.orgId,
      actorId: null,
      actorType: 'system',
      entityType: 'document',
      entityId: ctx.id,
      action: 'document.extracted',
      description: `Extraction completed for "${ctx.fileName}" (${ctx.vendorName}) — ${flagCount} compliance ${flagCount === 1 ? 'flag' : 'flags'}`,
      after: { extraction_status: 'extracted', compliance_flags: flagCount },
      metadata: { rfp_id: ctx.rfpId, vendor_account_id: ctx.vendorAccountId, submission_id: ctx.submissionId },
    })
  } catch (err) {
    const message = err instanceof ScannedDocumentError || err instanceof AiError ? err.message : GENERIC_FAILURE
    if (!(err instanceof ScannedDocumentError)) console.error('processDocument failed', ctx.id, err)
    await admin.from('documents').update({ extraction_status: 'failed', extraction_error: message }).eq('id', ctx.id)
    await logActivity({
      orgId: ctx.orgId,
      actorId: null,
      actorType: 'system',
      entityType: 'document',
      entityId: ctx.id,
      action: 'document.extraction_failed',
      description: `Extraction failed for "${ctx.fileName}" (${ctx.vendorName})`,
      after: { extraction_status: 'failed', error: message },
      metadata: { rfp_id: ctx.rfpId, vendor_account_id: ctx.vendorAccountId, submission_id: ctx.submissionId },
    })
    // App Flow §8.3: AI extraction fails → PM, in-app.
    const pm = await findPm(ctx.orgId)
    if (pm) {
      await notify({
        orgId: ctx.orgId,
        recipientId: pm.id,
        type: 'extraction_failed',
        title: `Extraction failed: ${ctx.fileName}`,
        body: `${ctx.vendorName} — "${ctx.rfpTitle}"`,
        entityType: 'rfp',
        entityId: ctx.rfpId,
      })
    }
  }
}

/** Every queued document of a just-submitted proposal, in parallel (each has its own AI budget). */
export async function processSubmission(submissionId: string): Promise<void> {
  const { data: docs } = await createAdminClient().from('documents').select('id').eq('submission_id', submissionId).eq('extraction_status', 'queued')
  await Promise.allSettled((docs ?? []).map((d) => processDocument(d.id)))
}

/** Compliance re-run for a submission's extracted documents (POST /api/process/compliance). */
export async function rerunSubmissionCompliance(submissionId: string): Promise<{ ok: number; failed: number }> {
  const { data: docs } = await createAdminClient()
    .from('documents')
    .select('id, org_id, file_name, file_type, storage_path, submissions!inner(rfp_id)')
    .eq('submission_id', submissionId)
    .eq('extraction_status', 'extracted')
  const results = await Promise.allSettled(
    (docs ?? []).map(async (d) => {
      const text = await loadDocumentText(d.storage_path, d.file_type)
      return runCompliance({ id: d.id, orgId: d.org_id, rfpId: d.submissions.rfp_id, fileName: d.file_name }, text)
    })
  )
  for (const r of results) if (r.status === 'rejected') console.error('compliance re-run failed', r.reason)
  return { ok: results.filter((r) => r.status === 'fulfilled').length, failed: results.filter((r) => r.status === 'rejected').length }
}
