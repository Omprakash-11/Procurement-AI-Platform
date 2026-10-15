import EvaluationReadyEmail from '@/emails/evaluation-ready'
import { logActivity } from '@/lib/activity'
import { appUrl } from '@/lib/api'
import { sendEmail } from '@/lib/email/send'
import { encodeRecommendation, loadReport } from '@/lib/evaluation'
import { generateJson } from '@/lib/gemini/client'
import { REPORT_PROMPT } from '@/lib/gemini/prompts'
import { notify } from '@/lib/processing/notify'
import { reportSchema } from '@/lib/schemas/ai'
import { createAdminClient } from '@/lib/supabase/server'

// PRD §5.5.1 / Backend Schema §8.4 report route: executive summary + advisory recommendation.
// The recommendation never changes workflow state (CLAUDE.md: AI output is advisory).

/** Generates and stores the report. Throws AiError (shown inline with Retry) on failure. */
export async function generateReport(rfpId: string, actorId: string): Promise<void> {
  const admin = createAdminClient()
  const report = await loadReport(admin, rfpId)
  if (!report) throw new Error('Report data not found.')
  const { evaluation } = report

  const scoredVendors = report.vendors.filter((v) => v.total !== null)
  const evaluationJson = JSON.stringify({
    criteria: evaluation.criteria.map((c) => ({ name: c.name, weight_percent: c.weight })),
    vendors: scoredVendors.map((v) => ({
      vendor_id: v.vendorAccountId,
      name: v.companyName,
      weighted_total: v.total,
      rank: v.rank,
      scores: evaluation.criteria.map((c) => ({ criterion: c.name, score: v.scores.find((s) => s.criterionId === c.id)?.effectiveScore ?? null })),
      compliance_flags: v.flags,
      key_terms: v.keyTerms,
    })),
  })

  const result = await generateJson({
    task: 'report',
    system: REPORT_PROMPT.system,
    prompt: REPORT_PROMPT.build({ title: report.rfp.title, description: report.rfp.description }, evaluationJson),
    jsonSchema: REPORT_PROMPT.jsonSchema,
    schema: reportSchema,
  })
  // Only a vendor that is actually in this evaluation can be named.
  const recommended = scoredVendors.some((v) => v.vendorAccountId === result.recommended_vendor_id) ? result.recommended_vendor_id : null

  const { data: rfp } = await admin.from('rfps').select('org_id, title, requirement_id').eq('id', rfpId).single()
  if (!rfp) throw new Error('RFP not found.')
  const before = { status: evaluation.status, report_generated_at: evaluation.reportGeneratedAt }
  const generatedAt = new Date().toISOString()
  const { error } = await admin
    .from('evaluations')
    .update({
      status: 'report_generated',
      report_executive_summary: result.executive_summary,
      report_recommendation: encodeRecommendation(recommended, result.recommendation_rationale),
      report_generated_at: generatedAt,
    })
    .eq('id', evaluation.id)
  if (error) throw new Error('Saving the report failed.')

  await logActivity({
    orgId: rfp.org_id,
    actorId,
    actorType: 'profile',
    entityType: 'evaluation',
    entityId: evaluation.id,
    action: 'report.generated',
    description: `Comparison report generated for "${rfp.title}"`,
    before,
    after: { status: 'report_generated', report_generated_at: generatedAt, recommended_vendor_id: recommended },
    metadata: { rfp_id: rfpId },
  })

  // Decision P7 defaults: the requirement's Department Head — in-app + email. Regenerating an
  // existing report doesn't notify again.
  if (!rfp.requirement_id || evaluation.reportGeneratedAt) return
  const { data: requirement } = await admin.from('requirements').select('raised_by').eq('id', rfp.requirement_id).maybeSingle()
  if (!requirement) return
  const { data: dh } = await admin.from('profiles').select('id, role, is_active').eq('id', requirement.raised_by).maybeSingle()
  if (!dh || dh.role !== 'department_head' || !dh.is_active) return
  await notify({
    orgId: rfp.org_id,
    recipientId: dh.id,
    type: 'evaluation_ready',
    title: 'Vendor evaluation ready',
    body: `The comparison report for "${rfp.title}" is ready.`,
    entityType: 'report',
    entityId: rfpId,
  })
  const { data: dhUser } = await admin.auth.admin.getUserById(dh.id)
  if (dhUser.user?.email) {
    try {
      await sendEmail({
        to: dhUser.user.email,
        subject: 'A vendor evaluation is ready',
        react: EvaluationReadyEmail({ rfpTitle: rfp.title, reportUrl: appUrl(`/pipeline/rfp/${rfpId}/report`) }),
      })
    } catch (err) {
      console.error('report: DH email failed', err)
    }
  }
}
