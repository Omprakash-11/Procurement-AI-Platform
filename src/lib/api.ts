import { NextResponse } from 'next/server'
import type { ZodError } from 'zod'

import { getAppClaims } from '@/lib/auth/claims'
import { createClient } from '@/lib/supabase/server'
import type { AppClaims, UserRole } from '@/types'

/** CLAUDE.md error shape: { error, code }. */
export function apiError(status: number, code: string, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, code, ...extra }, { status })
}

export function validationError(err: ZodError) {
  return apiError(400, 'validation_error', 'Some fields are invalid.', { fields: err.flatten().fieldErrors })
}

export const INTERNAL_ROLES: UserRole[] = ['procurement_manager', 'department_head', 'finance_approver']

type AuthOk = {
  ok: true
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  email: string | undefined
  claims: AppClaims
}
type AuthFail = { ok: false; response: NextResponse }

/** Authenticate (validated with the Auth server), then check the role. */
export async function requireUser(roles?: UserRole[]): Promise<AuthOk | AuthFail> {
  const supabase = await createClient()
  const { data: userData, error } = await supabase.auth.getUser()
  if (error || !userData.user) {
    return { ok: false, response: apiError(401, 'unauthenticated', 'Your session has expired. Please sign in again.') }
  }
  const { data: sessionData } = await supabase.auth.getSession()
  const claims = getAppClaims(sessionData.session?.access_token)

  if (claims.user_type !== 'internal' && roles) {
    return { ok: false, response: apiError(403, 'forbidden', 'You do not have permission to do that.') }
  }
  if (roles && (claims.role === undefined || claims.role === 'vendor' || !roles.includes(claims.role))) {
    return { ok: false, response: apiError(403, 'forbidden', 'You do not have permission to do that.') }
  }
  return { ok: true, supabase, userId: userData.user.id, email: userData.user.email, claims }
}

export function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return new URL(path, base).toString()
}
