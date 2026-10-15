import { NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity'
import { apiError, requireUser, validationError } from '@/lib/api'
import { notifyPmOfRequirement } from '@/lib/processing/notify'
import { requirementRequestSchema } from '@/lib/schemas/requirement'

type Params = { params: Promise<{ id: string }> }

const FIELDS = 'id, org_id, title, description, department, budget_estimate, required_by, priority, status, linked_rfp_id, raised_by, created_at, updated_at'

// GET /api/requirements/[id] — DH (own) / PM (any in org); RLS decides.
export async function GET(_request: Request, { params }: Params) {
  const auth = await requireUser(['procurement_manager', 'department_head'])
  if (!auth.ok) return auth.response
  const { id } = await params
  const { data } = await auth.supabase.from('requirements').select(FIELDS).eq('id', id).eq('is_deleted', false).maybeSingle()
  if (!data) return apiError(404, 'not_found', 'Requirement not found.')
  return NextResponse.json({ requirement: data })
}

// PATCH /api/requirements/[id] — App Flow §5 "Edit option: only available when status is
// Draft or Submitted (before PM has actioned)". DH only (RLS requirements_dh_update). A draft
// can be submitted; a submitted requirement never goes back to draft.
export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireUser(['department_head'])
  if (!auth.ok) return auth.response
  const { id } = await params
  const parsed = requirementRequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return validationError(parsed.error)
  const v = parsed.data

  const { data: before } = await auth.supabase.from('requirements').select(FIELDS).eq('id', id).eq('is_deleted', false).maybeSingle()
  if (!before || before.raised_by !== auth.userId) return apiError(404, 'not_found', 'Requirement not found.')
  if (!['draft', 'submitted'].includes(before.status) || before.linked_rfp_id) {
    return apiError(409, 'locked', 'The procurement team has already actioned this requirement, so it can no longer be edited.')
  }

  const nextStatus = before.status === 'submitted' || v.submit ? 'submitted' : 'draft'
  const { data: after, error } = await auth.supabase
    .from('requirements')
    .update({
      title: v.title,
      description: v.description,
      department: v.department,
      budget_estimate: v.budgetEstimate,
      required_by: v.requiredBy,
      priority: v.priority,
      status: nextStatus,
    })
    .eq('id', id)
    .select(FIELDS)
    .single()
  if (error || !after) return apiError(500, 'save_failed', 'We could not save the requirement. Please try again.')

  const submittedNow = before.status === 'draft' && nextStatus === 'submitted'
  const { org_id: orgId, ...beforeState } = before
  const afterState = Object.fromEntries(Object.entries(after).filter(([key]) => key !== 'org_id'))
  await logActivity({
    orgId,
    actorId: auth.userId,
    actorType: 'profile',
    entityType: 'requirement',
    entityId: id,
    action: submittedNow ? 'requirement.submitted' : 'requirement.edited',
    description: submittedNow ? `Requirement "${after.title}" submitted` : `Requirement "${after.title}" edited`,
    before: beforeState,
    after: afterState,
  })
  if (submittedNow) await notifyPmOfRequirement(orgId, id, after.title)
  return NextResponse.json({ requirement: after })
}
