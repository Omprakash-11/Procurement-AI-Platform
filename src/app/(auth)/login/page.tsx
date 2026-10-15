import type { Metadata } from 'next'

import { LoginForm } from '@/components/auth/login-form'
import { safeRedirectPath } from '@/lib/auth/routes'
import { DEMO_LOGINS, isDemoMode } from '@/lib/demo'

export const metadata: Metadata = { title: 'Sign in — ProcureMaster' }

type LoginPageProps = { searchParams: Promise<{ redirectTo?: string; reason?: string }> }

// App Flow §3 — Login. No self-serve signup link (P3-1).
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { redirectTo, reason } = await searchParams
  return <LoginForm redirectTo={safeRedirectPath(redirectTo, '')} reason={reason ?? null} demo={isDemoMode() ? DEMO_LOGINS : null} />
}
