import { Activity, CheckSquare, ClipboardList, FileText, Kanban, LayoutDashboard, Settings, type LucideIcon } from 'lucide-react'

import type { UserRole } from '@/types'

export type NavItem = { href: string; label: string; icon: LucideIcon; roles: UserRole[] }

// App Flow §2.1 (+ decision P4-1: FA also gets Activity). Icons: Content Guidelines §10.3.
// Settings is rendered separately, above the user area (Content Guidelines §5.2).
export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['procurement_manager', 'department_head', 'finance_approver'] },
  { href: '/pipeline', label: 'Pipeline', icon: Kanban, roles: ['procurement_manager'] },
  { href: '/requirements', label: 'Requirements', icon: ClipboardList, roles: ['procurement_manager', 'department_head'] },
  { href: '/approvals', label: 'Approvals', icon: CheckSquare, roles: ['finance_approver'] },
  { href: '/contracts', label: 'Contracts', icon: FileText, roles: ['procurement_manager'] },
  { href: '/activity', label: 'Activity', icon: Activity, roles: ['procurement_manager', 'department_head', 'finance_approver'] },
]

export const SETTINGS_ITEM: NavItem = { href: '/settings/organisation', label: 'Settings', icon: Settings, roles: ['procurement_manager'] }
