import type { Metadata } from 'next'

import { ResetPasswordForm } from '@/components/auth/reset-password-form'

export const metadata: Metadata = { title: 'Set a new password — ProcureMaster' }

type ResetPasswordPageProps = { params: Promise<{ token: string }> }

// App Flow §3 — /reset-password/[token]. The one-time token is verified on submit, so
// opening the page doesn't consume it.
export default async function ResetPasswordPage({ params }: ResetPasswordPageProps) {
  const { token } = await params
  return <ResetPasswordForm tokenHash={decodeURIComponent(token)} />
}
