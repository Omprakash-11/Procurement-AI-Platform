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

// Phase 10: Postgres / PostgREST error codes → user-friendly { error, code }.
const DB_ERRORS: Record<string, [number, string, string]> = {
  '23505': [409, 'conflict', 'That already exists.'],
  '23503': [409, 'conflict', 'This item is linked to something that no longer exists.'],
  '23514': [400, 'validation_error', 'Some values are not allowed.'],
  '42501': [403, 'forbidden', 'You do not have permission to do that.'],
  PGRST116: [404, 'not_found', 'Not found.'],
}

/** Map a thrown error (Supabase / Postgres / anything) to the CLAUDE.md error response. */
export function errorResponse(err: unknown) {
  const code = (err as { code?: unknown } | null)?.code
  const mapped = typeof code === 'string' ? DB_ERRORS[code] : undefined
  if (mapped) return apiError(mapped[0], mapped[1], mapped[2])
  console.error('Unhandled API error', err)
  return apiError(500, 'internal_error', 'Something went wrong. Please try again.')
}

/**
 * Phase 10: every Route Handler is wrapped so an unexpected throw still answers with the
 * { error, code } shape instead of an HTML error page.
 */
export function withErrors<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args)
    } catch (err) {
      // next/navigation redirect()/notFound() signal by throwing — let them through.
      if (err && typeof err === 'object' && 'digest' in err && typeof (err as { digest: unknown }).digest === 'string' && /^NEXT_/.test((err as { digest: string }).digest)) throw err
      return errorResponse(err)
    }
  }
}
