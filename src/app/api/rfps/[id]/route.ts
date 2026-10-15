import { NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity'
import { apiError, INTERNAL_ROLES, requireUser, validationError, withErrors } from '@/lib/api'
import { loadRfpDetail } from '@/lib/rfps'
import { rfpUpdateSchema } from '@/lib/schemas/rfp'
import { isDraggableStage, RFP_STATUS_LABEL, type RfpStatus } from '@/lib/status'

type Params = { params: Promise<{ id: string }> }

// GET /api/rfps/[id] — Backend Schema §8.2 (PM, DH, FA): RFP + vendor list. RLS
// (can_read_rfp) decides which RFPs a DH / FA may see.
export const GET = withErrors(async function GET(_request: Request, { params }: Params) {
  const auth = await requireUser(INTERNAL_ROLES)
  if (!auth.ok) return auth.response
  const { id } = await params
  const detail = await loadRfpDetail(auth.supabase, id)
  if (!detail) return apiError(404, 'not_found', 'RFP not found.')
  return NextResponse.json(detail)
})

// PATCH /api/rfps/[id] — field edits and/or status (PM). Decision P5-1: Approval Pending /
// Contracted are workflow-owned (never set here, never left from here); Archived can't be
// left; 'archived' is only sent by the confirmed "Archive RFP" action.
export const PATCH = withErrors(async function PATCH(request: Request, { params }: Params) {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response
  const { id } = await params

  const parsed = rfpUpdateSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return validationError(parsed.error)
  const u = parsed.data

  const { data: before } = await auth.supabase
    .from('rfps')
    .select('id, org_id, title, description, department, budget_min, budget_max, submission_deadline, status')
    .eq('id', id)
    .eq('is_deleted', false)
    .maybeSingle()
  if (!before) return apiError(404, 'not_found', 'RFP not found.')

  if (u.status && u.status !== before.status && !isDraggableStage(before.status)) {
    return apiError(409, 'stage_locked', `RFPs in ${RFP_STATUS_LABEL[before.status]} can't be moved by hand.`)
  }
  const nextMin = u.budgetMin === undefined ? before.budget_min : u.budgetMin
  const nextMax = u.budgetMax === undefined ? before.budget_max : u.budgetMax
  if (nextMin !== null && nextMax !== null && nextMin > nextMax) {
    return apiError(400, 'validation_error', 'Some fields are invalid.', { fields: { budgetMax: ['Maximum must be at least the minimum.'] } })
  }

  const changes = {
    ...(u.title !== undefined && { title: u.title }),
    ...(u.description !== undefined && { description: u.description }),
    ...(u.department !== undefined && { department: u.department }),
    ...(u.budgetMin !== undefined && { budget_min: u.budgetMin }),
    ...(u.budgetMax !== undefined && { budget_max: u.budgetMax }),
    ...(u.submissionDeadline !== undefined && { submission_deadline: u.submissionDeadline }),
    ...(u.status !== undefined && { status: u.status as RfpStatus }),
  }

  const { data: after, error } = await auth.supabase
    .from('rfps')
    .update(changes)
    .eq('id', id)
    .select('id, title, description, department, budget_min, budget_max, submission_deadline, status')
    .single()
  if (error || !after) return apiError(500, 'update_failed', 'We could not update the RFP. Please try again.')

  const statusChanged = u.status !== undefined && u.status !== before.status
  const { org_id: orgId, ...beforeState } = before
  await logActivity({
    orgId,
    actorId: auth.userId,
    actorType: 'profile',
    entityType: 'rfp',
    entityId: id,
    action: after.status === 'archived' && statusChanged ? 'rfp.archived' : statusChanged ? 'rfp.status_changed' : 'rfp.edited',
    description: statusChanged
      ? `"${after.title}" moved from ${RFP_STATUS_LABEL[before.status]} to ${RFP_STATUS_LABEL[after.status]}`
      : `"${after.title}" edited`,
    before: beforeState,
    after,
    metadata: { rfp_id: id },
  })

  // Decision P8-6: archiving the RFP closes the requirement it answers.
  if (after.status === 'archived' && statusChanged) {
    const { data: closed } = await auth.supabase
      .from('requirements')
      .update({ status: 'closed' })
      .eq('linked_rfp_id', id)
      .neq('status', 'closed')
      .select('id, title, status')
    for (const req of closed ?? []) {
      await logActivity({
        orgId,
        actorId: auth.userId,
        actorType: 'profile',
        entityType: 'requirement',
        entityId: req.id,
        action: 'requirement.status_changed',
        description: `Requirement "${req.title}" closed (RFP archived)`,
        after: { status: 'closed' },
        metadata: { rfp_id: id },
      })
    }
  }

  return NextResponse.json({ rfp: after })
})

// DELETE /api/rfps/[id] — soft delete (Backend Schema §8.2; CLAUDE.md: never hard-delete).
export const DELETE = withErrors(async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response
  const { id } = await params

  const { data: before } = await auth.supabase.from('rfps').select('id, org_id, title').eq('id', id).eq('is_deleted', false).maybeSingle()
  if (!before) return apiError(404, 'not_found', 'RFP not found.')

  const { error } = await auth.supabase.from('rfps').update({ is_deleted: true }).eq('id', id)
  if (error) return apiError(500, 'delete_failed', 'We could not delete the RFP.')

  await logActivity({
    orgId: before.org_id,
    actorId: auth.userId,
    actorType: 'profile',
    entityType: 'rfp',
    entityId: id,
    action: 'rfp.deleted',
    description: `RFP "${before.title}" deleted`,
    before: { is_deleted: false },
    after: { is_deleted: true },
    metadata: { rfp_id: id },
  })
  return NextResponse.json({ status: 'deleted' })
})
