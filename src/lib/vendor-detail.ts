import type { SupabaseClient } from '@supabase/supabase-js'

import { extractionSchema, type Extraction } from '@/lib/schemas/ai'
import type { Database, Enums } from '@/types'

// Vendor Detail tabs (App Flow §4): documents with extraction results, and their compliance
// flags. Read with the PM's client — RLS shows only submitted documents (P7-4).

export type VendorDocument = {
  id: string
  fileName: string
  fileType: Enums<'document_type'>
  fileSizeBytes: number
  status: Enums<'extraction_status'>
  error: string | null
  attempts: number
  uploadedAt: string
  updatedAt: string
  extraction: Extraction | null
}

export type VendorFlag = {
  id: string
  documentId: string
  fileName: string
  flagType: Enums<'flag_type'>
  severity: Enums<'flag_severity'>
  clauseText: string | null
  explanation: string
  status: Enums<'flag_status'>
  acknowledgedAt: string | null
  createdAt: string
}

export type VendorNote = { id: string; body: string; createdAt: string; authorName: string }

export type VendorDocumentsResponse = { submissionId: string | null; documents: VendorDocument[]; flags: VendorFlag[] }

const SEVERITY_ORDER: Record<Enums<'flag_severity'>, number> = { high: 0, medium: 1, low: 2 }

export async function loadVendorDocuments(client: SupabaseClient<Database>, rfpId: string, vendorAccountId: string): Promise<VendorDocumentsResponse> {
  const { data: submission } = await client
    .from('submissions')
    .select('id, documents(id, file_name, file_type, file_size_bytes, extraction_status, extraction_error, extraction_attempts, created_at, updated_at, raw_extraction, compliance_flags(id, flag_type, severity, clause_text, explanation, status, acknowledged_at, created_at))')
    .eq('rfp_id', rfpId)
    .eq('vendor_account_id', vendorAccountId)
    .neq('status', 'in_progress')
    .maybeSingle()
  if (!submission) return { submissionId: null, documents: [], flags: [] }

  const docs = [...submission.documents].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const documents: VendorDocument[] = docs.map((d) => {
    const parsed = d.extraction_status === 'extracted' ? extractionSchema.safeParse(d.raw_extraction) : null
    return {
      id: d.id,
      fileName: d.file_name,
      fileType: d.file_type,
      fileSizeBytes: d.file_size_bytes,
      status: d.extraction_status,
      error: d.extraction_error,
      attempts: d.extraction_attempts,
      uploadedAt: d.created_at,
      updatedAt: d.updated_at,
      extraction: parsed?.success ? parsed.data : null,
    }
  })
  const flags: VendorFlag[] = docs
    .flatMap((d) =>
      d.compliance_flags.map((f) => ({
        id: f.id,
        documentId: d.id,
        fileName: d.file_name,
        flagType: f.flag_type,
        severity: f.severity,
        clauseText: f.clause_text,
        explanation: f.explanation,
        status: f.status,
        acknowledgedAt: f.acknowledged_at,
        createdAt: f.created_at,
      }))
    )
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)) // stable: one AI call = one created_at
  return { submissionId: submission.id, documents, flags }
}

export const FLAG_TYPE_LABEL: Record<Enums<'flag_type'>, string> = {
  payment_terms: 'Payment terms',
  penalty_clause: 'Penalty clause',
  fee_structure: 'Fee structure',
  price_escalation: 'Price escalation',
  auto_renewal: 'Auto-renewal',
  liability_limitation: 'Liability limitation',
  unilateral_modification: 'Unilateral modification',
  jurisdiction: 'Jurisdiction',
  ip_ownership: 'IP ownership',
  data_breach_notification: 'Data breach notification',
}

export const EXTRACTION_FIELDS: { key: keyof Extraction; label: string }[] = [
  { key: 'vendor_name', label: 'Vendor name' },
  { key: 'contact_information', label: 'Contact information' },
  { key: 'company_overview', label: 'Company overview' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'payment_terms', label: 'Payment terms' },
  { key: 'cost_breakdown', label: 'Cost breakdown' },
  { key: 'delivery_timeline', label: 'Delivery timeline' },
  { key: 'sla', label: 'SLAs' },
  { key: 'warranty_liability', label: 'Warranty & liability' },
  { key: 'termination', label: 'Termination' },
  { key: 'data_privacy', label: 'Data privacy & security' },
  { key: 'differentiators', label: 'Differentiators' },
]
