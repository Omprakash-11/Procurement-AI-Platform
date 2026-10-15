import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { SubmitForApproval } from '@/components/approvals/submit-for-approval'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { PageContainer } from '@/components/layout/page-header'
import { ReportActions } from '@/components/report/report-actions'
import { ReportComments } from '@/components/report/report-comments'
import { ReportView } from '@/components/report/report-view'
import { loadApprovalOptions } from '@/lib/approval-options'
import { getShellUser } from '@/lib/auth/current-user'
import { loadReport } from '@/lib/evaluation'
import { loadReportComments } from '@/lib/report-comments'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Comparison report — ProcureMaster' }

type ReportPageProps = { params: Promise<{ id: string }> }

const LOCKED = ['approval_pending', 'contracted', 'archived']

// App Flow §4 Comparison Report — PM (full: Export, Share, Submit for Approval) / DH (read-only,
// plus their recommendation comments, P8-3). Middleware + can_read_rfp gate access.
export default async function ReportPage({ params }: ReportPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const [report, user, { data: rfp }] = await Promise.all([
    loadReport(supabase, id),
    getShellUser(),
    supabase.from('rfps').select('status').eq('id', id).maybeSingle(),
  ])
  if (!report || !rfp) notFound()
  const isPm = user?.role === 'procurement_manager'
  const generated = Boolean(report.evaluation.reportGeneratedAt)
  const [options, comments] = await Promise.all([
    isPm && generated ? loadApprovalOptions(supabase, id) : Promise.resolve(null),
    generated ? loadReportComments(supabase, id) : Promise.resolve([]),
  ])

  return (
    <>
      <Breadcrumb
        items={[
          isPm ? { label: 'Pipeline', href: '/pipeline' } : { label: 'Pipeline' },
          isPm ? { label: report.rfp.title, href: `/pipeline/rfp/${id}` } : { label: report.rfp.title },
          { label: 'Comparison Report' },
        ]}
      />
      <PageContainer>
        {generated ? (
          <div className="space-y-12">
            <ReportView
              report={report}
              actions={
                isPm && options ? (
                  <div className="flex flex-col items-end gap-3">
                    <ReportActions rfpId={id} />
                    <SubmitForApproval
                      rfpId={id}
                      shortlisted={options.shortlisted}
                      approvers={options.approvers}
                      recommendedVendorId={report.evaluation.recommendation?.vendorAccountId ?? null}
                      pending={options.pending}
                      eligible={!LOCKED.includes(rfp.status)}
                    />
                  </div>
                ) : undefined
              }
            />
            <ReportComments rfpId={id} initialComments={comments} canComment={user?.role === 'department_head'} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">The comparison report has not been generated yet.</p>
        )}
      </PageContainer>
    </>
  )
}
