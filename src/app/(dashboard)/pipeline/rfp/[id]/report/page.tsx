import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Breadcrumb } from '@/components/layout/breadcrumb'
import { PageContainer } from '@/components/layout/page-header'
import { ReportActions } from '@/components/report/report-actions'
import { ReportView } from '@/components/report/report-view'
import { getShellUser } from '@/lib/auth/current-user'
import { loadReport } from '@/lib/evaluation'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Comparison report — ProcureMaster' }

type ReportPageProps = { params: Promise<{ id: string }> }

// App Flow §4 Comparison Report — PM (full) / DH (read-only; middleware + can_read_rfp).
export default async function ReportPage({ params }: ReportPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const [report, user] = await Promise.all([loadReport(supabase, id), getShellUser()])
  if (!report) notFound()
  const isPm = user?.role === 'procurement_manager'

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
        {report.evaluation.reportGeneratedAt ? (
          <ReportView report={report} actions={isPm ? <ReportActions rfpId={id} /> : undefined} />
        ) : (
          <p className="text-sm text-muted-foreground">The comparison report has not been generated yet.</p>
        )}
      </PageContainer>
    </>
  )
}
