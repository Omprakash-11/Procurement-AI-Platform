import { z } from 'zod'

import { DRAGGABLE_STAGES } from '@/lib/status'

const money = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === 'string' ? v.trim() : v))
  .refine((v) => v === '' || (!Number.isNaN(Number(v)) && Number(v) >= 0), 'Enter an amount of 0 or more.')
  .transform((v) => (v === '' ? null : Number(v)))

// App Flow §4 Create RFP: Title (required), Description (required), Department, Budget Min/Max,
// Submission Deadline. Department is required by the schema (rfps.department NOT NULL).
export const rfpSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required.').max(200),
    description: z.string().trim().min(1, 'Description is required.').max(10_000),
    department: z.string().trim().min(1, 'Department is required.').max(120),
    budgetMin: money,
    budgetMax: money,
    /** yyyy-mm-dd from the date input; stored as the end of that day in the user's time zone. */
    submissionDeadline: z
      .string()
      .trim()
      .refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Enter a valid date.'),
    requirementId: z.string().uuid().optional(),
  })
  .refine((v) => v.budgetMin === null || v.budgetMax === null || v.budgetMin <= v.budgetMax, {
    message: 'Maximum must be at least the minimum.',
    path: ['budgetMax'],
  })
export type RFPFormInput = z.input<typeof rfpSchema>
export type RFPFormValues = z.output<typeof rfpSchema>

// API body: same fields, deadline already converted to an ISO timestamp by the client.
export const rfpRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(10_000),
    department: z.string().trim().min(1).max(120),
    budgetMin: z.number().nonnegative().nullable(),
    budgetMax: z.number().nonnegative().nullable(),
    submissionDeadline: z.string().datetime({ offset: true }).nullable(),
    requirementId: z.string().uuid().optional(),
  })
  .refine((v) => v.budgetMin === null || v.budgetMax === null || v.budgetMin <= v.budgetMax, {
    message: 'Maximum must be at least the minimum.',
    path: ['budgetMax'],
  })
export type RFPRequest = z.infer<typeof rfpRequestSchema>

// PATCH /api/rfps/[id]: field edits and/or a status move. Decision P5-1: drags only between
// working stages; 'archived' only via the Archive action (confirmed in the UI).
export const rfpUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().min(1).max(10_000).optional(),
    department: z.string().trim().min(1).max(120).optional(),
    budgetMin: z.number().nonnegative().nullable().optional(),
    budgetMax: z.number().nonnegative().nullable().optional(),
    submissionDeadline: z.string().datetime({ offset: true }).nullable().optional(),
    status: z.enum([...(DRAGGABLE_STAGES as [string, ...string[]]), 'archived']).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update.')
export type RFPUpdate = z.infer<typeof rfpUpdateSchema>

/** yyyy-mm-dd → ISO timestamp at 23:59:59 local time (the deadline lasts the whole day). */
export function deadlineToIso(date: string): string | null {
  if (!date) return null
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y!, m! - 1, d!, 23, 59, 59).toISOString()
}

/** ISO timestamp → yyyy-mm-dd in local time, for the date input. */
export function isoToDateInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
