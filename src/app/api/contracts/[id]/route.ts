import { NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity'
import { loadActivity } from '@/lib/activity-feed'
import { apiError, requireUser, validationError } from '@/lib/api'
import { loadContract, statusAfterEdit } from '@/lib/contracts'
import { contractPatchSchema } from '@/lib/schemas/contract'

type Params = { params: Promise<{ id: string }> }

const COLUMNS = 'id, org_id, title, value, payment_terms, start_date, end_date, alert_days, status, rfp_id, vendor_account_id'

// GET /api/contracts/[id] — Backend Schema §8.7: detail with its activity log (PM).
export async function GET(_request: Request, { params }: Params) {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response
  const { id } = await params
  const contract = await loadContract(auth.supabase, id)
  if (!contract) return apiError(404, 'not_found', 'Contract not found.')
  const activity = await loadActivity(auth.supabase, { contractId: id, limit: 50 })
  return NextResponse.json({ contract, activity: activity.items })
}

// PATCH /api/contracts/[id] — Backend Schema §8.7: value, dates, alert days, terms, name.
// App Flow §4: the alert threshold can change at any time. Not on terminated contracts.
export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response
  const { id } = await params
  const parsed = contractPatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return validationError(parsed.error)
  const u = parsed.data

  const { data: before } = await auth.supabase.from('contracts').select(COLUMNS).eq('id', id).eq('is_deleted', false).maybeSingle()
  if (!before) return apiError(404, 'not_found', 'Contract not found.')
  if (before.status === 'terminated') return apiError(409, 'terminated', 'This contract has been terminated and can no longer be changed.')
  const startDate = u.startDate ?? before.start_date
  const endDate = u.endDate ?? before.end_date
  if (startDate > endDate) return apiError(400, 'validation_error', 'Some fields are invalid.', { fields: { endDate: ['End date must be on or after the start date.'] } })
  const alertDays = u.alertDays ?? before.alert_days

  const { data: after, error } = await auth.supabase
    .from('contracts')
    .update({
      ...(u.title !== undefined && { title: u.title }),
      ...(u.value !== undefined && { value: u.value }),
      ...(u.paymentTerms !== undefined && { payment_terms: u.paymentTerms || null }),
      ...(u.startDate !== undefined && { start_date: u.startDate }),
      ...(u.endDate !== undefined && { end_date: u.endDate }),
      ...(u.alertDays !== undefined && { alert_days: u.alertDays }),
      status: statusAfterEdit(before.status, endDate, alertDays),
    })
    .eq('id', id)
    .select(COLUMNS)
    .single()
  if (error || !after) return apiError(500, 'update_failed', 'We could not update the contract. Please try again.')

  const onlyAlert = Object.keys(u).length === 1 && u.alertDays !== undefined
  const { org_id: orgId, ...beforeState } = before
  await logActivity({
    orgId,
    actorId: auth.userId,
    actorType: 'profile',
    entityType: 'contract',
    entityId: id,
    action: onlyAlert ? 'contract.alert_threshold_changed' : 'contract.edited',
    description: onlyAlert ? `Renewal alert for "${after.title}" set to ${after.alert_days} days` : `Contract "${after.title}" edited`,
    before: beforeState,
    after: Object.fromEntries(Object.entries(after).filter(([k]) => k !== 'org_id')),
    metadata: { rfp_id: before.rfp_id, vendor_account_id: before.vendor_account_id, contract_id: id },
  })
  return NextResponse.json({ contract: after })
}

// DELETE /api/contracts/[id] — Plan Phase 9: soft delete (CLAUDE.md: never hard-delete).
export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response
  const { id } = await params
  const { data: before } = await auth.supabase.from('contracts').select('id, org_id, title, rfp_id, vendor_account_id').eq('id', id).eq('is_deleted', false).maybeSingle()
  if (!before) return apiError(404, 'not_found', 'Contract not found.')
  const { error } = await auth.supabase.from('contracts').update({ is_deleted: true }).eq('id', id)
  if (error) return apiError(500, 'delete_failed', 'We could not delete the contract.')
  await logActivity({
    orgId: before.org_id, actorId: auth.userId, actorType: 'profile', entityType: 'contract', entityId: id,
    action: 'contract.deleted', description: `Contract "${before.title}" deleted`, before: { is_deleted: false }, after: { is_deleted: true },
    metadata: { rfp_id: before.rfp_id, vendor_account_id: before.vendor_account_id, contract_id: id },
  })
  return NextResponse.json({ status: 'deleted' })
}
