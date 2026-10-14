import type { AppClaims, UserRole } from '@/types'

// App Flow §1 site map. Paths that never require a session.
const PUBLIC_PREFIXES = ['/login', '/signup', '/reset-password', '/accept-invite', '/auth/confirm', '/vendor/invite']

// Signed-in users are sent home from these.
const AUTH_ONLY_PAGES = ['/login', '/signup']

// Internal app (route group (dashboard)) — vendors never enter.
const INTERNAL_PREFIXES = [
  '/dashboard', '/pipeline', '/requirements', '/approvals', '/contracts',
  '/activity', '/search', '/settings', '/account', '/onboarding',
]

const matches = (path: string, prefix: string) => path === prefix || path.startsWith(prefix + '/')

// App Flow §1 per-route access; first matching rule wins. Unlisted internal paths are open
// to all internal roles.
const ROLE_RULES: { test: (path: string) => boolean; roles: UserRole[] }[] = [
  { test: (p) => matches(p, '/onboarding'), roles: ['procurement_manager'] },
  // The comparison report is the only pipeline page a DH may open (read-only).
  { test: (p) => /^\/pipeline\/rfp\/[^/]+\/report\/?$/.test(p), roles: ['procurement_manager', 'department_head'] },
  { test: (p) => matches(p, '/pipeline'), roles: ['procurement_manager'] },
  { test: (p) => matches(p, '/requirements'), roles: ['procurement_manager', 'department_head'] },
  { test: (p) => matches(p, '/approvals'), roles: ['finance_approver'] },
  { test: (p) => matches(p, '/contracts'), roles: ['procurement_manager'] },
  { test: (p) => matches(p, '/settings'), roles: ['procurement_manager'] },
]

export const isPublicPath = (path: string) => PUBLIC_PREFIXES.some((p) => matches(path, p))
export const isAuthOnlyPage = (path: string) => AUTH_ONLY_PAGES.some((p) => matches(path, p))
export const isInternalPath = (path: string) => INTERNAL_PREFIXES.some((p) => matches(path, p))
export const isVendorPath = (path: string) => matches(path, '/vendor') && !matches(path, '/vendor/invite')

export function canAccess(path: string, claims: AppClaims): boolean {
  const rule = ROLE_RULES.find((r) => r.test(path))
  if (!rule) return true
  return claims.role !== undefined && claims.role !== 'vendor' && rule.roles.includes(claims.role)
}

/**
 * Only same-origin relative paths — prevents open redirects via ?redirectTo= / ?next=.
 * Browsers strip tabs/newlines and treat "\" like "/", so "/\t/evil.com" or "/\evil.com"
 * would become protocol-relative; reject those, then confirm the parsed origin is ours.
 */
export function safeRedirectPath(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback
  if (/[\u0000-\u001F\u007F\\]/.test(value)) return fallback
  if (!value.startsWith('/') || value.startsWith('//')) return fallback
  try {
    const base = 'http://internal.invalid'
    const url = new URL(value, base)
    if (url.origin !== base) return fallback
    return url.pathname + url.search + url.hash
  } catch {
    return fallback
  }
}
