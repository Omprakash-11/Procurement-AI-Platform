import { StatusBadge, type StatusTone } from '@/components/ui/status-badge'
import type { VendorFacingStatus } from '@/lib/vendor/portal'

const TONE: Record<VendorFacingStatus, StatusTone> = {
  Invited: 'neutral',
  Submitted: 'info',
  'Under Review': 'info',
  Shortlisted: 'warning',
  'Not Selected': 'neutral',
  Contracted: 'success',
}

export function VendorStatusBadge({ status }: { status: VendorFacingStatus }) {
  return (
    <StatusBadge tone={TONE[status]} data-testid="vendor-status">
      {status}
    </StatusBadge>
  )
}
