import { z } from 'zod'

import { Constants } from '@/types/database'

// Decision P8-1: the PM picks the shortlisted vendor and the Finance Approver.
export const approvalRequestSchema = z.object({
  rfpId: z.string().uuid(),
  vendorAccountId: z.string().uuid({ message: 'Choose a vendor.' }),
  financeApproverId: z.string().uuid({ message: 'Choose a finance approver.' }),
})
export type ApprovalRequestBody = z.infer<typeof approvalRequestSchema>

// App Flow §6 decision modals: comment mandatory for both; reject also needs a reason.
export const approveSchema = z.object({
  decision: z.literal('approved'),
  comment: z.string().trim().min(1, 'Add a comment.').max(2000, 'Keep the comment under 2000 characters.'),
})
export const rejectSchema = z.object({
  decision: z.literal('rejected'),
  comment: z.string().trim().min(1, 'Add a comment.').max(2000, 'Keep the comment under 2000 characters.'),
  reason: z.enum(Constants.public.Enums.rejection_reason, { errorMap: () => ({ message: 'Choose a reason.' }) }),
})
export const decisionSchema = z.discriminatedUnion('decision', [approveSchema, rejectSchema])
export type DecisionRequest = z.infer<typeof decisionSchema>

export const REJECTION_REASON_LABEL: Record<(typeof Constants.public.Enums.rejection_reason)[number], string> = {
  budget_concerns: 'Budget concerns',
  compliance_risk: 'Compliance risk',
  insufficient_information: 'Insufficient information',
  other: 'Other',
}
