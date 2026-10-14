import { z } from 'zod'

import { passwordSchema } from '@/lib/schemas/auth'

// App Flow §7 invite acceptance: new vendors give full name, company (prefilled), password;
// existing vendor logins confirm with their password.
export const vendorAcceptCreateSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Full name is required.').max(120),
    companyName: z.string().trim().min(1, 'Company name is required.').max(200),
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password.'),
  })
  .refine((v) => v.password === v.confirmPassword, { message: 'Passwords do not match.', path: ['confirmPassword'] })
export type VendorAcceptCreateValues = z.infer<typeof vendorAcceptCreateSchema>

export const vendorAcceptLoginSchema = z.object({ password: z.string().min(1, 'Password is required.') })
export type VendorAcceptLoginValues = z.infer<typeof vendorAcceptLoginSchema>

export const vendorAcceptRequestSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('create'), fullName: z.string().trim().min(1).max(120), companyName: z.string().trim().min(1).max(200), password: passwordSchema }),
  z.object({ mode: z.literal('login'), password: z.string().min(1) }),
])

// Tech Stack §6.1 upload constraints (decision P6-1: verified again server-side after upload).
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024
export const ACCEPTED_TYPES = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
} as const
export type AcceptedMime = keyof typeof ACCEPTED_TYPES
export const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.xlsx']

export const uploadSignSchema = z.object({
  action: z.literal('sign'),
  fileName: z.string().trim().min(1).max(200),
  fileSize: z.number().int().positive(),
  mimeType: z.string(),
})
export const uploadConfirmSchema = z.object({
  action: z.literal('confirm'),
  path: z.string().min(1).max(500),
  fileName: z.string().trim().min(1).max(200),
})
export const uploadRequestSchema = z.discriminatedUnion('action', [uploadSignSchema, uploadConfirmSchema])

export const createSubmissionSchema = z.object({ rfpId: z.string().uuid() })
