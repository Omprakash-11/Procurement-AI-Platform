import { NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity'
import { apiError, requireUser, validationError, withErrors } from '@/lib/api'
import { flagActionSchema } from '@/lib/schemas/evaluation'
import { FLAG_TYPE_LABEL } from '@/lib/vendor-detail'

type Params = { params: Promise<{ id: string }> }

// PATCH /api/compliance-flags/[id] — not in Backend Schema §8; added for the Compliance tab's
// Acknowledge / Escalate actions (App Flow §4). PM only (RLS flags_pm_write). The link from an
// escalated flag to the approval request comes with Phase 8 (#15).
export const PATCH = withErrors(async function PATCH(request: Request, { params }: Params) {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response
  const { id } = await params
  const parsed = flagActionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return validationError(parsed.error)

  const { data: flag } = await auth.supabase
    .from('compliance_flags')
    .select('id, org_id, flag_type, severity, status, documents!inner(file_name, submissions!inner(rfp_id, vendor_account_id))')
    .eq('id', id)
    .maybeSingle()
  if (!flag) return apiError(404, 'not_found', 'Flag not found.')

  const status = parsed.data.action === 'acknowledge' ? 'acknowledged' : 'escalated'
  if (flag.status === status) return NextResponse.json({ status })
  const { error } = await auth.supabase
    .from('compliance_flags')
    .update({ status, acknowledged_by: auth.userId, acknowledged_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return apiError(500, 'save_failed', 'We could not update the flag. Please try again.')

  await logActivity({
    orgId: flag.org_id,
    actorId: auth.userId,
    actorType: 'profile',
    entityType: 'compliance_flag',
    entityId: id,
    action: `compliance_flag.${status}`,
    description: `${flag.severity[0]!.toUpperCase()}${flag.severity.slice(1)} risk "${FLAG_TYPE_LABEL[flag.flag_type]}" ${status} (${flag.documents.file_name})`,
    before: { status: flag.status },
    after: { status },
    metadata: { rfp_id: flag.documents.submissions.rfp_id, vendor_account_id: flag.documents.submissions.vendor_account_id },
  })
  return NextResponse.json({ status })
})
