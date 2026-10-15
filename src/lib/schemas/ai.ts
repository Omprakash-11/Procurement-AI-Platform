import { z } from 'zod'

import { Constants } from '@/types/database'

// Zod schemas for every Gemini response (CLAUDE.md: JSON.parse, then validate with Zod before
// anything is written to the database).

const text = z.string().trim().max(4000)
const nullableText = text.nullable().transform((v) => (v === '' ? null : v))

// PRD §5.3.2 extraction fields; the 8 promoted columns of documents (Schema §2.9).
export const extractionSchema = z.object({
  vendor_name: nullableText,
  contact_information: nullableText,
  company_overview: nullableText,
  pricing: nullableText,
  payment_terms: nullableText,
  cost_breakdown: nullableText,
  delivery_timeline: nullableText,
  sla: nullableText,
  warranty_liability: nullableText,
  termination: nullableText,
  data_privacy: nullableText,
  differentiators: nullableText,
})
export type Extraction = z.infer<typeof extractionSchema>

// PRD §5.4 compliance flag types / severities (Schema §2.13 enums).
export const complianceSchema = z.object({
  flags: z
    .array(
      z.object({
        flag_type: z.enum(Constants.public.Enums.flag_type),
        severity: z.enum(Constants.public.Enums.flag_severity),
        clause_text: text.nullable(),
        explanation: z.string().trim().min(1).max(2000),
      })
    )
    .max(40),
})
export type ComplianceResult = z.infer<typeof complianceSchema>

// PRD §5.3.3: 5–10 criteria with suggested weights.
export const criteriaSuggestionSchema = z.object({
  criteria: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        description: z.string().trim().max(500).nullable(),
        weight: z.number().min(0).max(100),
      })
    )
    .min(5)
    .max(10),
})
export type CriteriaSuggestion = z.infer<typeof criteriaSuggestionSchema>

// PRD §5.3.3: 0–10 per criterion with a reasoning note.
export const scoringSchema = z.object({
  scores: z.array(
    z.object({
      criterion_id: z.string().uuid(),
      score: z.number().min(0).max(10),
      reasoning: z.string().trim().min(1).max(2000),
    })
  ),
})
export type ScoringResult = z.infer<typeof scoringSchema>

// PRD §5.5.1 executive summary + advisory recommendation.
export const reportSchema = z.object({
  executive_summary: z.string().trim().min(1).max(4000),
  recommended_vendor_id: z.string().uuid().nullable(),
  recommendation_rationale: z.string().trim().min(1).max(2000),
})
export type ReportResult = z.infer<typeof reportSchema>
