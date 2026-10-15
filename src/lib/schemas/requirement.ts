import { z } from 'zod'

import { Constants } from '@/types/database'

const money = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === 'string' ? v.trim() : v))
  .refine((v) => v === '' || (!Number.isNaN(Number(v)) && Number(v) >= 0), 'Enter an amount of 0 or more.')
  .transform((v) => (v === '' ? null : Number(v)))

const dateOnly = z
  .string()
  .trim()
  .refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Enter a valid date.')

// App Flow §5 Submit Requirement: Title (required), Description (required), Department
// (pre-filled, editable), Estimated Budget (optional), Required Delivery Date, Priority.
export const requirementSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(200, 'Keep the title under 200 characters.'),
  description: z.string().trim().min(1, 'Description is required.').max(10_000),
  department: z.string().trim().min(1, 'Department is required.').max(120),
  budgetEstimate: money,
  requiredBy: dateOnly,
  priority: z.enum(Constants.public.Enums.requirement_priority),
})
export type RequirementFormInput = z.input<typeof requirementSchema>
export type RequirementFormValues = z.output<typeof requirementSchema>

/** POST / PATCH body: the form values plus whether to submit now or keep as a draft. */
export const requirementRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(10_000),
  department: z.string().trim().min(1).max(120),
  budgetEstimate: z.number().nonnegative().nullable(),
  requiredBy: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  priority: z.enum(Constants.public.Enums.requirement_priority),
  submit: z.boolean(),
})
export type RequirementRequest = z.infer<typeof requirementRequestSchema>

// App Flow §5 attachments: PDF / DOCX / XLSX, max 20MB (decision P8-4).
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024
export const ATTACHMENT_SIZE_ERROR = 'File exceeds the 20MB limit. Please compress or split the file.'

export const attachmentUploadSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('sign'), fileName: z.string().trim().min(1).max(200), fileSize: z.number().int().positive(), mimeType: z.string() }),
  z.object({ action: z.literal('confirm'), fileName: z.string().trim().min(1).max(200), path: z.string().min(1).max(500) }),
])

export const reportCommentSchema = z.object({
  body: z.string().trim().min(1, 'Write a comment first.').max(5000, 'Keep comments under 5000 characters.'),
})
export type ReportCommentRequest = z.infer<typeof reportCommentSchema>
