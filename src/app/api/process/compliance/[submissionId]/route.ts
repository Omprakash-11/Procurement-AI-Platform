import { waitUntil } from '@vercel/functions'
import { NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity'
import { apiError, requireUser, withErrors } from '@/lib/api'
import { rerunSubmissionCompliance } from '@/lib/processing/documents'
import { EVALUATION_LOCKED, evaluationLockedMessage } from '@/lib/processing/locks'

export const maxDuration = 300

type Params = { params: Promise<{ submissionId: string }> }

// POST /api/process/compliance/[submissionId] — Backend Schema §8.4. Decision P7-4: compliance
// already runs with extraction on submit; this route re-runs it for a submission's processed
// documents (open flags are replaced; acknowledged / escalated ones are kept).
export const POST = withErrors(async function POST(_request: Request, { params }: Params) {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response
  const { submissionId } = await params

  const { data: submission } = await auth.supabase
    .from('submissions')
    .select('id, org_id, rfp_id, vendor_account_id, status, rfps!inner(title, status)')
    .eq('id', submissionId)
    .maybeSingle()
  if (!submission || submission.status === 'in_progress') return apiError(404, 'not_found', 'Submission not found.')
  if (EVALUATION_LOCKED.includes(submission.rfps.status)) return apiError(409, 'locked', evaluationLockedMessage)

  await logActivity({
    orgId: submission.org_id,
    actorId: auth.userId,
    actorType: 'profile',
    entityType: 'submission',
    entityId: submissionId,
    action: 'compliance.rerun',
    description: `Compliance check re-run for a submission on "${submission.rfps.title}"`,
    metadata: { rfp_id: submission.rfp_id, vendor_account_id: submission.vendor_account_id },
  })
  waitUntil(rerunSubmissionCompliance(submissionId))
  return NextResponse.json({ status: 'running' }, { status: 202 })
})
