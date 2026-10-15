import { NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity'
import { apiError, requireUser, validationError } from '@/lib/api'
import { notifyPmOfRequirement } from '@/lib/processing/notify'
import { requirementRequestSchema } from '@/lib/schemas/requirement'

// GET /api/requirements — Plan Phase 8: DH sees their own, PM sees all (RLS
// requirements_dh_read / requirements_pm_read decide).
export async function GET() {
  const auth = await requireUser(['procurement_manager', 'department_head'])
  if (!auth.ok) return auth.response
  const { data } = await auth.supabase
    .from('requirements')
    .select('id, title, department, priority, status, linked_rfp_id, created_at, updated_at, profiles!requirements_raised_by_fkey(full_name)')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
  return NextResponse.json({ requirements: data ?? [] })
}

// POST /api/requirements — App Flow §5 Submit Requirement (DH): "Submit Requirement" or
// "Save as Draft". On submit the PM gets an in-app notification (App Flow §5).
export async function POST(request: Request) {
  const auth = await requireUser(['department_head'])
  if (!auth.ok) return auth.response
  const parsed = requirementRequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return validationError(parsed.error)
  const v = parsed.data
  const orgId = auth.claims.org_id
  if (!orgId) return apiError(403, 'forbidden', 'You do not have permission to do that.')

  // RLS requirements_dh_insert: own org, raised_by = self, draft / submitted only.
  const { data: req, error } = await auth.supabase
    .from('requirements')
    .insert({
      org_id: orgId,
      raised_by: auth.userId,
      title: v.title,
      description: v.description,
      department: v.department,
      budget_estimate: v.budgetEstimate,
      required_by: v.requiredBy,
      priority: v.priority,
      status: v.submit ? 'submitted' : 'draft',
    })
    .select('id, title, status, department, priority')
    .single()
  if (error || !req) return apiError(500, 'save_failed', 'We could not save the requirement. Please try again.')

  await logActivity({
    orgId,
    actorId: auth.userId,
    actorType: 'profile',
    entityType: 'requirement',
    entityId: req.id,
    action: v.submit ? 'requirement.submitted' : 'requirement.drafted',
    description: v.submit ? `Requirement "${req.title}" submitted` : `Requirement "${req.title}" saved as draft`,
    after: req,
  })
  if (v.submit) await notifyPmOfRequirement(orgId, req.id, req.title)
  return NextResponse.json({ requirement: req }, { status: 201 })
}

