import { NextResponse, type NextRequest } from 'next/server'

import { logActivity } from '@/lib/activity'
import { apiError, requireUser, validationError, withErrors } from '@/lib/api'
import { rfpRequestSchema } from '@/lib/schemas/rfp'
import { RFP_STAGES, type RfpStatus } from '@/lib/status'

const STATUSES = RFP_STAGES.map((s) => s.status)

// GET /api/rfps — Backend Schema §8.2 (PM): RFPs for the org with filters, plus (decision
// P5-2) submitted requirements that have no RFP yet, for the "Requirements Received" column.
// Filters: department, status, from/to (submission deadline — P5 default), q (title search).
export const GET = withErrors(async function GET(request: NextRequest) {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response
  const p = request.nextUrl.searchParams

  let query = auth.supabase
    .from('rfps')
    .select('id, title, department, status, submission_deadline, updated_at, requirement_id, rfp_vendor_entries(count)')
    .eq('is_deleted', false)
    .order('updated_at', { ascending: false })
  const department = p.get('department')
  const status = p.get('status')
  const from = p.get('from')
  const to = p.get('to')
  const q = p.get('q')?.trim()
  if (department) query = query.eq('department', department)
  if (status && STATUSES.includes(status as RfpStatus)) query = query.eq('status', status as RfpStatus)
  if (from) query = query.gte('submission_deadline', from)
  if (to) query = query.lte('submission_deadline', to)
  // Full-text search on the generated tsvector (CLAUDE.md: never ILIKE for search).
  if (q) query = query.textSearch('search_vector', q, { type: 'websearch', config: 'english' })

  const { data: rfps, error } = await query
  if (error) return apiError(500, 'load_failed', 'We could not load RFPs.')

  const { data: requirements } = await auth.supabase
    .from('requirements')
    .select('id, title, department, required_by, priority, created_at')
    .eq('status', 'submitted')
    .is('linked_rfp_id', null)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })

  return NextResponse.json({
    rfps: (rfps ?? []).map(({ rfp_vendor_entries, ...r }) => ({ ...r, vendor_count: rfp_vendor_entries[0]?.count ?? 0 })),
    requirements: requirements ?? [],
  })
})

// POST /api/rfps — create (PM). The rfp_evaluation_created trigger adds the evaluation.
// Decision P5-2: with requirementId, links the requirement and moves it to In Progress.
export const POST = withErrors(async function POST(request: Request) {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response
  const orgId = auth.claims.org_id
  if (!orgId) return apiError(403, 'forbidden', 'You do not have permission to do that.')

  const parsed = rfpRequestSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return validationError(parsed.error)
  const v = parsed.data

  let requirement: { id: string; title: string } | null = null
  if (v.requirementId) {
    const { data } = await auth.supabase
      .from('requirements')
      .select('id, title, status, linked_rfp_id')
      .eq('id', v.requirementId)
      .eq('is_deleted', false)
      .maybeSingle()
    if (!data) return apiError(404, 'requirement_not_found', 'That requirement was not found.')
    if (data.linked_rfp_id || data.status !== 'submitted') {
      return apiError(409, 'requirement_already_actioned', 'An RFP has already been created for this requirement.')
    }
    requirement = data
  }

  const { data: rfp, error } = await auth.supabase
    .from('rfps')
    .insert({
      org_id: orgId,
      created_by: auth.userId,
      requirement_id: requirement?.id ?? null,
      title: v.title,
      description: v.description,
      department: v.department,
      budget_min: v.budgetMin,
      budget_max: v.budgetMax,
      submission_deadline: v.submissionDeadline,
    })
    .select('id, title, department, status, submission_deadline, budget_min, budget_max')
    .single()
  if (error || !rfp) return apiError(500, 'create_failed', 'We could not create the RFP. Please try again.')

  await logActivity({
    orgId,
    actorId: auth.userId,
    actorType: 'profile',
    entityType: 'rfp',
    entityId: rfp.id,
    action: 'rfp.created',
    description: `RFP "${rfp.title}" created`,
    after: rfp,
    metadata: { rfp_id: rfp.id, requirement_id: requirement?.id ?? null },
  })

  if (requirement) {
    const { error: linkError } = await auth.supabase
      .from('requirements')
      .update({ linked_rfp_id: rfp.id, status: 'in_progress' })
      .eq('id', requirement.id)
    if (!linkError) {
      await logActivity({
        orgId,
        actorId: auth.userId,
        actorType: 'profile',
        entityType: 'requirement',
        entityId: requirement.id,
        action: 'requirement.status_changed',
        description: `Requirement "${requirement.title}" moved to In Progress`,
        before: { status: 'submitted', linked_rfp_id: null },
        after: { status: 'in_progress', linked_rfp_id: rfp.id },
        metadata: { rfp_id: rfp.id },
      })
    }
  }

  return NextResponse.json({ rfp }, { status: 201 })
})
