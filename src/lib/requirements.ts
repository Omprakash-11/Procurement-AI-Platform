import type { StatusTone } from '@/components/ui/status-badge'
import type { Enums } from '@/types'

// App Flow §5 requirement statuses: Draft → Submitted → In Progress → Vendor Selected → Closed.
export const REQUIREMENT_STATUS_LABEL: Record<Enums<'requirement_status'>, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  in_progress: 'In Progress',
  vendor_selected: 'Vendor Selected',
  closed: 'Closed',
}

export const REQUIREMENT_STATUS_TONE: Record<Enums<'requirement_status'>, StatusTone> = {
  draft: 'neutral',
  submitted: 'info',
  in_progress: 'info',
  vendor_selected: 'success',
  closed: 'neutral',
}

export const PRIORITY_LABEL: Record<Enums<'requirement_priority'>, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}
