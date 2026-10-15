import { NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity'
import { apiError, requireUser, validationError } from '@/lib/api'
import { loadTemplates } from '@/lib/scoring-templates'
import { templateSchema } from '@/lib/schemas/evaluation'

// Scoring templates (Backend Schema §2.16, decision P4-8 — built in Phase 7). Not in Backend
// Schema §8. PM only (RLS scoring_templates_pm); soft delete.
export async function GET() {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response
  return NextResponse.json({ templates: await loadTemplates(auth.supabase) })
}

export async function POST(request: Request) {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response
  const parsed = templateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return validationError(parsed.error)
  const orgId = auth.claims.org_id
  if (!orgId) return apiError(403, 'forbidden', 'You do not have permission to do that.')

  const criteria = parsed.data.criteria.map((c, i) => ({ name: c.name, description: c.description ?? null, weight: c.weight, sort_order: i }))
  const { data, error } = await auth.supabase
    .from('scoring_templates')
    .insert({ org_id: orgId, created_by: auth.userId, name: parsed.data.name, criteria })
    .select('id')
    .single()
  if (error || !data) return apiError(500, 'save_failed', 'We could not save the template. Please try again.')

  await logActivity({
    orgId,
    actorId: auth.userId,
    actorType: 'profile',
    entityType: 'scoring_template',
    entityId: data.id,
    action: 'scoring_template.created',
    description: `Scoring template "${parsed.data.name}" created`,
    after: { name: parsed.data.name, criteria },
  })
  return NextResponse.json({ id: data.id }, { status: 201 })
}
