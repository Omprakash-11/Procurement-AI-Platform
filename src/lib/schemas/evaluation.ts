import { z } from 'zod'

// Request bodies for the Phase 7 evaluation routes (Backend Schema §8.5 + App Flow §4 actions).

const weight = z.coerce
  .number({ invalid_type_error: 'Enter a weight.' })
  .min(0.01, 'Weight must be more than 0.')
  .max(100, 'Weight cannot exceed 100.')
  .refine((v) => Math.round(v * 100) === v * 100, 'Use at most two decimals.')

export const criterionInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(120, 'Keep the name under 120 characters.'),
  description: z.string().trim().max(500).nullable().optional(),
  weight,
  isAiSuggested: z.boolean().default(false),
})

/** Weights must add up to exactly 100 (App Flow §4 criteria modal; trigger §6.5 caps at 100). */
export const totalIs100 = (criteria: { weight: number }[]) => Math.round(criteria.reduce((s, c) => s + c.weight, 0) * 100) === 10_000

export const criteriaSchema = z.object({
  criteria: z
    .array(criterionInputSchema)
    .min(1, 'Add at least one criterion.')
    .max(20, 'Use at most 20 criteria.')
    .refine(totalIs100, 'Weights must add up to 100%.'),
  templateId: z.string().uuid().nullable().optional(),
})
export type CriteriaRequest = z.infer<typeof criteriaSchema>
export type CriterionInput = z.input<typeof criterionInputSchema>

export const scoreRequestSchema = z.object({
  /** Retry one vendor within the current run; omitted = full re-score (new run). */
  vendorAccountId: z.string().uuid().optional(),
})

export const overrideSchema = z.object({
  score: z.coerce.number({ invalid_type_error: 'Score must be between 0 and 10.' }).min(0, 'Score must be between 0 and 10.').max(10, 'Score must be between 0 and 10.'),
  justification: z.string().trim().min(1, 'Add a justification.').max(1000, 'Keep it under 1000 characters.'),
})
export type OverrideRequest = z.infer<typeof overrideSchema>

export const flagActionSchema = z.object({ action: z.enum(['acknowledge', 'escalate']) })

export const noteSchema = z.object({
  body: z.string().trim().min(1, 'Write a note first.').max(5000, 'Keep notes under 5000 characters.'),
})
export type NoteRequest = z.infer<typeof noteSchema>

export const templateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(120, 'Keep the name under 120 characters.'),
  criteria: criteriaSchema.shape.criteria,
})
export type TemplateRequest = z.infer<typeof templateSchema>

/** scoring_templates.criteria JSON shape (Backend Schema §2.16). */
export const storedTemplateCriteria = z.array(
  z.object({ name: z.string(), description: z.string().nullable().optional(), weight: z.number(), sort_order: z.number().optional() })
)
