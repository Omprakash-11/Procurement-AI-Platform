import type { StatusTone } from '@/components/ui/status-badge'
import type { Enums } from '@/types'

// Labels and badge tones for pipeline statuses (App Flow §4, Content Guidelines §6.3).
// Pure data — safe on server and client.

export type RfpStatus = Enums<'rfp_status'>
export type VendorStatus = Enums<'vendor_pipeline_status'>

// Kanban columns, left to right (App Flow §4).
export const RFP_STAGES: { status: RfpStatus; label: string }[] = [
  { status: 'requirements_received', label: 'Requirements Received' },
  { status: 'rfp_created', label: 'RFP Created' },
  { status: 'vendors_invited', label: 'Vendors Invited' },
  { status: 'submissions_in', label: 'Submissions In' },
  { status: 'under_evaluation', label: 'Under Evaluation' },
  { status: 'shortlisted', label: 'Shortlisted' },
  { status: 'approval_pending', label: 'Approval Pending' },
  { status: 'contracted', label: 'Contracted' },
  { status: 'archived', label: 'Archived' },
]

export const RFP_STATUS_LABEL = Object.fromEntries(RFP_STAGES.map((s) => [s.status, s.label])) as Record<RfpStatus, string>

export const RFP_STATUS_TONE: Record<RfpStatus, StatusTone> = {
  requirements_received: 'neutral',
  rfp_created: 'neutral',
  vendors_invited: 'info',
  submissions_in: 'info',
  under_evaluation: 'info',
  shortlisted: 'warning',
  approval_pending: 'warning',
  contracted: 'success',
  archived: 'neutral',
}

// Decision P5-1: the PM may drag only between these working stages.
export const DRAGGABLE_STAGES: RfpStatus[] = [
  'requirements_received',
  'rfp_created',
  'vendors_invited',
  'submissions_in',
  'under_evaluation',
  'shortlisted',
]
export const isDraggableStage = (s: RfpStatus) => DRAGGABLE_STAGES.includes(s)

// "Active" RFPs for the dashboard: not finished.
export const ACTIVE_RFP_STATUSES: RfpStatus[] = DRAGGABLE_STAGES.concat('approval_pending')

export const VENDOR_STATUS_LABEL: Record<VendorStatus, string> = {
  invited: 'Invited',
  submitted: 'Submitted',
  under_review: 'Under Review',
  shortlisted: 'Shortlisted',
  approved: 'Approved',
  not_selected: 'Not Selected',
  contracted: 'Contracted',
}

export const VENDOR_STATUS_TONE: Record<VendorStatus, StatusTone> = {
  invited: 'neutral',
  submitted: 'info',
  under_review: 'info',
  shortlisted: 'warning',
  approved: 'success',
  not_selected: 'neutral',
  contracted: 'success',
}

// Decision P5-6: shortlisting is possible once the vendor has submitted.
export const SHORTLISTABLE: VendorStatus[] = ['submitted', 'under_review', 'shortlisted']
