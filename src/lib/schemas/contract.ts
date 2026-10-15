import { z } from 'zod'

const money = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === 'string' ? v.trim() : v))
  .refine((v) => v === '' || (!Number.isNaN(Number(v)) && Number(v) >= 0), 'Enter an amount of 0 or more.')
  .transform((v) => (v === '' ? null : Number(v)))

const date = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date.')

// App Flow §4 Contract Detail fields; Backend Schema §8.7 PATCH (value, dates, alert_days, …).
export const contractEditSchema = z
  .object({
    title: z.string().trim().min(1, 'Contract name is required.').max(200),
    value: money,
    paymentTerms: z.string().trim().max(2000),
    startDate: date,
    endDate: date,
  })
  .refine((v) => v.startDate <= v.endDate, { message: 'End date must be on or after the start date.', path: ['endDate'] })
export type ContractEditInput = z.input<typeof contractEditSchema>
export type ContractEditValues = z.output<typeof contractEditSchema>

export const alertDaysSchema = z.coerce
  .number({ invalid_type_error: 'Enter a number of days.' })
  .int('Use whole days.')
  .min(1, 'Use at least 1 day.')
  .max(730, 'Use at most 730 days.')

export const contractPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    value: z.number().nonnegative().nullable().optional(),
    paymentTerms: z.string().trim().max(2000).nullable().optional(),
    startDate: date.optional(),
    endDate: date.optional(),
    alertDays: alertDaysSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update.')
export type ContractPatch = z.infer<typeof contractPatchSchema>

export const terminateSchema = z.object({
  reason: z.string().trim().min(1, 'Give a reason for terminating.').max(2000, 'Keep it under 2000 characters.'),
})
export type TerminateRequest = z.infer<typeof terminateSchema>
