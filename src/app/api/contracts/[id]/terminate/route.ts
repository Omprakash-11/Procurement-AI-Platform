import { NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity'
import { apiError, requireUser, validationError, withErrors } from '@/lib/api'
import { terminateSchema } from '@/lib/schemas/contract'

type Params = { params: Promise<{ id: string }> }

// PATCH /api/contracts/[id]/terminate — Backend Schema §8.7 / App Flow §4 "Mark as Terminated"
// (confirmation modal with a reason). PM only.
export const PATCH = withErrors(async function PATCH(request: Request, { params }: Params) {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response
  const { id } = await params
  const parsed = terminateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return validationError(parsed.error)

  const { data: before } = await auth.supabase.from('contracts').select('id, org_id, title, status, rfp_id, vendor_account_id').eq('id', id).eq('is_deleted', false).maybeSingle()
  if (!before) return apiError(404, 'not_found', 'Contract not found.')
  if (before.status === 'terminated') return apiError(409, 'already_terminated', 'This contract is already terminated.')

  const terminatedAt = new Date().toISOString()
  const { error } = await auth.supabase
    .from('contracts')
    .update({ status: 'terminated', terminated_at: terminatedAt, terminated_by: auth.userId, termination_reason: parsed.data.reason })
    .eq('id', id)
  if (error) return apiError(500, 'update_failed', 'We could not terminate the contract. Please try again.')

  await logActivity({
    orgId: before.org_id, actorId: auth.userId, actorType: 'profile', entityType: 'contract', entityId: id,
    action: 'contract.terminated', description: `Contract "${before.title}" terminated`,
    before: { status: before.status }, after: { status: 'terminated', termination_reason: parsed.data.reason, terminated_at: terminatedAt },
    metadata: { rfp_id: before.rfp_id, vendor_account_id: before.vendor_account_id, contract_id: id },
  })
  return NextResponse.json({ status: 'terminated' })
})
