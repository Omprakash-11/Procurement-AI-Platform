import type { UserRole } from '@/types'

// Pure helpers, safe to import from both server and client components.

export const ROLE_LABELS: Record<UserRole, string> = {
  procurement_manager: 'Procurement Manager',
  department_head: 'Department Head',
  finance_approver: 'Finance Approver',
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')
  return letters.toUpperCase() || '?'
}
