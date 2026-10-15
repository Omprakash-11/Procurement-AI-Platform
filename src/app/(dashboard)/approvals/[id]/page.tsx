import { format, formatDistanceToNowStrict } from 'date-fns'
import { AlertTriangle } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { SlaBadge } from '@/components/approvals/approvals-table'
import { DecisionPanel } from '@/components/approvals/decision-panel'
import { AiSparkles } from '@/components/evaluation/ai-marker'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { PageContainer, PageHeader } from '@/components/layout/page-header'
import { ReportComments } from '@/components/report/report-comments'
import { ReportView } from '@/components/report/report-view'
import { StatusBadge } from '@/components/ui/status-badge'
import { loadApproval } from '@/lib/approval-data'
import { APPROVAL_STATUS_LABEL, APPROVAL_STATUS_TONE } from '@/lib/approvals'
import { getShellUser } from '@/lib/auth/current-user'
import { loadReport } from '@/lib/evaluation'
import { loadReportComments } from '@/lib/report-comments'
import { REJECTION_REASON_LABEL } from '@/lib/schemas/approval'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Approval request — ProcureMaster' }

type ApprovalPageProps = { params: Promise<{ id: string }> }

const SEVERITY_TONE = { high: 'danger', medium: 'warning', low: 'neutral' } as const

// App Flow §6 Approval Request Detail (FA): header with SLA countdown, linked RFP and vendor,
// escalated compliance flags at the top (P8-5), the full read-only comparison report, the
// department's recommendations (P8-3), then the decision section — only for the FA it was sent
// to (P8-1). Decided requests show decision, comment and time, with no actions.
export default async function ApprovalPage({ params }: ApprovalPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const [approval, user] = await Promise.all([loadApproval(supabase, id), getShellUser()])
  if (!approval || !user) notFound()
  const [report, comments] = await Promise.all([loadReport(supabase, approval.rfpId), loadReportComments(supabase, approval.rfpId)])
  const due = new Date(approval.slaDueAt)
  const overdue = due.getTime() <= Date.now()
  const isAssignee = approval.submittedToId === user.id

  return (
    <>
      <Breadcrumb items={[{ label: 'Approvals', href: '/approvals' }, { label: approval.rfpTitle }]} />
      <PageContainer>
        <PageHeader
          title={`Vendor selection: ${approval.rfpTitle}`}
          description={`Submitted by ${approval.submittedByName} on ${format(new Date(approval.submittedAt), 'd MMM yyyy, HH:mm')} · assigned to ${approval.submittedToName}`}
          action={<StatusBadge tone={APPROVAL_STATUS_TONE[approval.status]}>{APPROVAL_STATUS_LABEL[approval.status]}</StatusBadge>}
        />
        <div className="space-y-10">
          <dl className="grid max-w-2xl grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Selected vendor</dt>
            <dd className="font-medium text-foreground" data-testid="approval-vendor">
              {approval.vendorName}
            </dd>
            <dt className="text-muted-foreground">RFP</dt>
            <dd className="text-foreground">{approval.rfpTitle}</dd>
            <dt className="text-muted-foreground">SLA deadline</dt>
            <dd className="flex items-center gap-2">
              <SlaBadge row={approval} />
              {approval.status === 'pending' && (
                <span className="text-xs text-muted-foreground" data-testid="sla-countdown">
                  {overdue ? `overdue by ${formatDistanceToNowStrict(due)}` : `due in ${formatDistanceToNowStrict(due)}`}
                </span>
              )}
            </dd>
          </dl>

          {approval.escalations.length > 0 && (
            <section aria-labelledby="escalations" className="space-y-3 rounded border border-border bg-status-warning/40 p-4">
              <h2 id="escalations" className="flex items-center gap-2 text-base font-semibold text-foreground">
                <AlertTriangle className="size-4" aria-hidden="true" />
                Compliance escalations ({approval.escalations.length})
              </h2>
              <ul className="space-y-3">
                {approval.escalations.map((f) => (
                  <li key={f.id} className="space-y-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                      <StatusBadge tone={SEVERITY_TONE[f.severity]}>{f.severity === 'high' ? 'High' : f.severity === 'medium' ? 'Medium' : 'Low'}</StatusBadge>
                      <AiSparkles />
                      {f.flagType}
                      <span className="text-xs font-normal text-muted-foreground">{f.fileName}</span>
                    </p>
                    <p className="text-sm text-foreground">{f.explanation}</p>
                    {f.clauseText && <blockquote className="border-l-2 border-border pl-3 text-sm text-muted-foreground">{f.clauseText}</blockquote>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {report && <ReportView report={report} />}
          <ReportComments rfpId={approval.rfpId} initialComments={comments} canComment={false} />

          {approval.status === 'pending' ? (
            isAssignee ? (
              <DecisionPanel approvalId={approval.id} vendorName={approval.vendorName} />
            ) : (
              <p className="text-sm text-muted-foreground">This request was sent to {approval.submittedToName}; only they can decide it.</p>
            )
          ) : (
            <section aria-labelledby="decision-outcome" className="space-y-2 rounded border border-border bg-card p-6 shadow-sm" data-testid="decision-outcome">
              <h2 id="decision-outcome" className="text-xl font-semibold text-foreground">
                {approval.status === 'recalled' ? 'Recalled by the procurement manager' : `${APPROVAL_STATUS_LABEL[approval.status]} by ${approval.decidedByName ?? 'the finance approver'}`}
              </h2>
              {(approval.decidedAt ?? approval.recalledAt) && (
                <p className="text-sm text-muted-foreground">{format(new Date((approval.decidedAt ?? approval.recalledAt)!), 'd MMM yyyy, HH:mm')}</p>
              )}
              {approval.rejectionReason && <p className="text-sm text-foreground">Reason: {REJECTION_REASON_LABEL[approval.rejectionReason]}</p>}
              {approval.decisionComment && <p className="whitespace-pre-line text-sm text-foreground">{approval.decisionComment}</p>}
            </section>
          )}
        </div>
      </PageContainer>
    </>
  )
}
