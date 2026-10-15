import { NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity'
import { apiError, requireUser, validationError, withErrors } from '@/lib/api'
import { templateSchema } from '@/lib/schemas/evaluation'

type Params = { params: Promise<{ id: string }> }

// PATCH / DELETE (soft) a scoring template — decision P4-8. PM only (RLS scoring_templates_pm).
export const PATCH = withErrors(async function PATCH(request: Request, { params }: Params) {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response
  const { id } = await params
  const parsed = templateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return validationError(parsed.error)

  const { data: before } = await auth.supabase.from('scoring_templates').select('id, org_id, name, criteria').eq('id', id).eq('is_deleted', false).maybeSingle()
  if (!before) return apiError(404, 'not_found', 'Template not found.')
  const criteria = parsed.data.criteria.map((c, i) => ({ name: c.name, description: c.description ?? null, weight: c.weight, sort_order: i }))
  const { error } = await auth.supabase.from('scoring_templates').update({ name: parsed.data.name, criteria }).eq('id', id)
  if (error) return apiError(500, 'save_failed', 'We could not save the template. Please try again.')

  await logActivity({
    orgId: before.org_id,
    actorId: auth.userId,
    actorType: 'profile',
    entityType: 'scoring_template',
    entityId: id,
    action: 'scoring_template.updated',
    description: `Scoring template "${parsed.data.name}" updated`,
    before: { name: before.name, criteria: before.criteria },
    after: { name: parsed.data.name, criteria },
  })
  return NextResponse.json({ id })
})

export const DELETE = withErrors(async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response
  const { id } = await params
  const { data: before } = await auth.supabase.from('scoring_templates').select('id, org_id, name').eq('id', id).eq('is_deleted', false).maybeSingle()
  if (!before) return apiError(404, 'not_found', 'Template not found.')
  const { error } = await auth.supabase.from('scoring_templates').update({ is_deleted: true }).eq('id', id)
  if (error) return apiError(500, 'delete_failed', 'We could not delete the template. Please try again.')

  await logActivity({
    orgId: before.org_id,
    actorId: auth.userId,
    actorType: 'profile',
    entityType: 'scoring_template',
    entityId: id,
    action: 'scoring_template.deleted',
    description: `Scoring template "${before.name}" deleted`,
    before: { is_deleted: false },
    after: { is_deleted: true },
  })
  return NextResponse.json({ status: 'deleted' })
})
