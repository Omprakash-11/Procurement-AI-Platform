import { z } from 'zod'

// App Flow §3.1 step 1 / §9 Organisation Profile. The currency list is not specified in the
// docs; these are common ISO 4217 codes and can be extended without schema changes.
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'SGD', 'AED', 'JPY'] as const

export const LOGO_MAX_BYTES = 2 * 1024 * 1024
export const LOGO_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

export const orgProfileSchema = z.object({
  name: z.string().trim().min(1, 'Organisation name is required.').max(120),
  currency: z.enum(CURRENCIES),
})
export type OrgProfileFormValues = z.infer<typeof orgProfileSchema>
