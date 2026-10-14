import { z } from 'zod'

// Decision P3-6: at least 8 characters with letters and digits (mirrors supabase/config.toml).
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .regex(/[A-Za-z]/, 'Password must include a letter.')
  .regex(/[0-9]/, 'Password must include a number.')

const emailSchema = z.string().trim().min(1, 'Email is required.').email('Enter a valid email address.')

const withConfirm = <T extends z.ZodRawShape>(shape: T) =>
  z
    .object({ ...shape, password: passwordSchema, confirmPassword: z.string().min(1, 'Confirm your password.') })
    .refine((v) => v.password === v.confirmPassword, { message: 'Passwords do not match.', path: ['confirmPassword'] })

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required.'),
})
export type LoginFormValues = z.infer<typeof loginSchema>

// Decision S-1: no password at signup — it is chosen after the email is proven (/set-password).
export const signupSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required.').max(120),
  email: emailSchema,
  orgName: z.string().trim().min(1, 'Organisation name is required.').max(120),
})
export type SignupFormValues = z.infer<typeof signupSchema>

export const setPasswordSchema = withConfirm({})
export type SetPasswordFormValues = z.infer<typeof setPasswordSchema>
export const setPasswordRequestSchema = z.object({ password: passwordSchema })

export const resetRequestSchema = z.object({ email: emailSchema })
export type ResetRequestFormValues = z.infer<typeof resetRequestSchema>

export const resetPasswordSchema = withConfirm({})
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>

export const resetPasswordConfirmSchema = z.object({
  tokenHash: z.string().min(1),
  password: passwordSchema,
})

export const acceptInviteSchema = withConfirm({
  fullName: z.string().trim().min(1, 'Full name is required.').max(120),
})
export type AcceptInviteFormValues = z.infer<typeof acceptInviteSchema>

export const acceptInviteRequestSchema = z.object({
  token: z.string().min(1),
  fullName: z.string().trim().min(1).max(120),
  password: passwordSchema,
})

// /account (App Flow §9.1)
export const accountProfileSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required.').max(120),
})
export type AccountProfileFormValues = z.infer<typeof accountProfileSchema>

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your new password.'),
  })
  .refine((v) => v.password === v.confirmPassword, { message: 'Passwords do not match.', path: ['confirmPassword'] })
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>
export const changePasswordRequestSchema = z.object({ currentPassword: z.string().min(1), password: passwordSchema })

export const INVITABLE_ROLES = ['department_head', 'finance_approver'] as const
export const MAX_TEAM_INVITES = 10 // App Flow §3.1 step 2

export const teamInviteRowSchema = z.object({
  email: emailSchema,
  role: z.enum(INVITABLE_ROLES, { errorMap: () => ({ message: 'Choose a role.' }) }),
})

export const inviteTeamSchema = z.object({
  invites: z.array(teamInviteRowSchema).min(1).max(MAX_TEAM_INVITES),
})
export type InviteTeamFormValues = z.infer<typeof inviteTeamSchema>
