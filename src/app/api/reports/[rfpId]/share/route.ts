import { addDays } from 'date-fns'
import { NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity'
import { apiError, appUrl, requireUser } from '@/lib/api'
import { newShareToken, SHARE_LINK_DAYS } from '@/lib/share-links'

type Params = { params: Promise<{ rfpId: string }> }

async function loadRfp(auth: Extract<Awaited<ReturnType<typeof requireUser>>, { ok: true }>, rfpId: string) {
  const { data } = await auth.supabase.from('rfps').select('id, org_id, title, is_deleted, evaluations(report_generated_at)').eq('id', rfpId).maybeSingle()
  return data && !data.is_deleted ? data : null
}

// POST /api/reports/[rfpId]/share — decision P7-6 (not in Backend Schema §8): "Copy Share
// Link" (App Flow §4) — a read-only URL valid for 7 days. PM only (RLS report_share_links_pm).
export async function POST(_request: Request, { params }: Params) {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response
  const { rfpId } = await params
  const rfp = await loadRfp(auth, rfpId)
  if (!rfp) return apiError(404, 'not_found', 'RFP not found.')
  if (!rfp.evaluations?.report_generated_at) return apiError(409, 'no_report', 'Generate the report before sharing it.')

  const { token, tokenHash } = newShareToken()
  const expiresAt = addDays(new Date(), SHARE_LINK_DAYS).toISOString()
  const { data: link, error } = await auth.supabase
    .from('report_share_links')
    .insert({ org_id: rfp.org_id, rfp_id: rfpId, created_by: auth.userId, token_hash: tokenHash, expires_at: expiresAt })
    .select('id')
    .single()
  if (error || !link) return apiError(500, 'save_failed', 'We could not create the link. Please try again.')

  await logActivity({
    orgId: rfp.org_id,
    actorId: auth.userId,
    actorType: 'profile',
    entityType: 'rfp',
    entityId: rfpId,
    action: 'report.share_link_created',
    description: `Share link created for the "${rfp.title}" report (expires in ${SHARE_LINK_DAYS} days)`,
    after: { share_link_id: link.id, expires_at: expiresAt },
    metadata: { rfp_id: rfpId },
  })
  return NextResponse.json({ url: appUrl(`/share/report/${token}`), expiresAt }, { status: 201 })
}

// DELETE /api/reports/[rfpId]/share — revoke every live link for this report (P7-6).
export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response
  const { rfpId } = await params
  const rfp = await loadRfp(auth, rfpId)
  if (!rfp) return apiError(404, 'not_found', 'RFP not found.')
  const { data: revoked, error } = await auth.supabase
    .from('report_share_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('rfp_id', rfpId)
    .is('revoked_at', null)
    .select('id')
  if (error) return apiError(500, 'save_failed', 'We could not revoke the links. Please try again.')
  if (revoked?.length) {
    await logActivity({
      orgId: rfp.org_id,
      actorId: auth.userId,
      actorType: 'profile',
      entityType: 'rfp',
      entityId: rfpId,
      action: 'report.share_links_revoked',
      description: `Share links revoked for the "${rfp.title}" report`,
      after: { revoked: revoked.length },
      metadata: { rfp_id: rfpId },
    })
  }
  return NextResponse.json({ revoked: revoked?.length ?? 0 })
}
