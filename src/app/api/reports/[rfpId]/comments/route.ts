import { NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity'
import { apiError, INTERNAL_ROLES, requireUser, validationError, withErrors } from '@/lib/api'
import { loadReportComments } from '@/lib/report-comments'
import { reportCommentSchema } from '@/lib/schemas/requirement'

type Params = { params: Promise<{ rfpId: string }> }

// Decision P8-3: DH recommendation comments on the comparison report (App Flow §5). Read by
// PM, the requirement's DH and an FA with an approval for the RFP (RLS report_comments_read).
export const GET = withErrors(async function GET(_request: Request, { params }: Params) {
  const auth = await requireUser(INTERNAL_ROLES)
  if (!auth.ok) return auth.response
  const { rfpId } = await params
  return NextResponse.json({ comments: await loadReportComments(auth.supabase, rfpId) })
})

// POST — only the DH whose requirement this RFP answers (RLS report_comments_dh_insert), once
// a report exists. Append-only.
export const POST = withErrors(async function POST(request: Request, { params }: Params) {
  const auth = await requireUser(['department_head'])
  if (!auth.ok) return auth.response
  const { rfpId } = await params
  const parsed = reportCommentSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return validationError(parsed.error)

  const { data: rfp } = await auth.supabase.from('rfps').select('id, org_id, title, evaluations(report_generated_at)').eq('id', rfpId).eq('is_deleted', false).maybeSingle()
  if (!rfp) return apiError(404, 'not_found', 'Report not found.')
  if (!rfp.evaluations?.report_generated_at) return apiError(409, 'no_report', 'The comparison report is not ready yet.')

  const { data: comment, error } = await auth.supabase
    .from('report_comments')
    .insert({ org_id: rfp.org_id, rfp_id: rfpId, author_id: auth.userId, body: parsed.data.body })
    .select('id, created_at')
    .single()
  if (error || !comment) return apiError(500, 'save_failed', 'We could not save the comment. Please try again.')

  await logActivity({
    orgId: rfp.org_id,
    actorId: auth.userId,
    actorType: 'profile',
    entityType: 'rfp',
    entityId: rfpId,
    action: 'report.comment_added',
    description: `Department head commented on the "${rfp.title}" report`,
    metadata: { rfp_id: rfpId, comment_id: comment.id },
  })
  return NextResponse.json({ id: comment.id, createdAt: comment.created_at }, { status: 201 })
})
