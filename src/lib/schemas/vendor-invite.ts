import { z } from 'zod'

// App Flow §4 Invite Vendor modal: email (required), company name (required), personal message.
export const vendorInviteSchema = z.object({
  email: z.string().trim().min(1, 'Vendor email is required.').email('Enter a valid email address.'),
  companyName: z.string().trim().min(1, 'Vendor company name is required.').max(200),
  personalMessage: z.string().trim().max(2000, 'Keep the message under 2,000 characters.').optional(),
})
export type VendorInviteFormValues = z.infer<typeof vendorInviteSchema>

// PATCH /api/rfps/[id]/vendors/[entryId] — decisions P5-5 (remove) and P5-6 (shortlist).
export const vendorEntryActionSchema = z.object({
  action: z.enum(['remove', 'shortlist', 'unshortlist']),
})

export const VENDOR_INVITE_TTL_HOURS = 72 // CLAUDE.md / PRD §6.5
