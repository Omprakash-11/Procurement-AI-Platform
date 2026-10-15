import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ReportView } from '@/components/report/report-view'
import { loadReport } from '@/lib/evaluation'
import { resolveShareToken } from '@/lib/share-links'
import { createAdminClient } from '@/lib/supabase/server'

// Decision P7-6: public, read-only comparison report behind a 7-day hashed token. Not indexed,
// never cached; an invalid, expired or revoked token is a plain 404.
export const metadata: Metadata = { title: 'Comparison report — ProcureMaster', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

type SharePageProps = { params: Promise<{ token: string }> }

export default async function SharedReportPage({ params }: SharePageProps) {
  const { token } = await params
  const rfpId = await resolveShareToken(token)
  if (!rfpId) notFound()
  // Service role after the token check: the reader has no session.
  const report = await loadReport(createAdminClient(), rfpId)
  if (!report || !report.evaluation.reportGeneratedAt) notFound()

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-8 py-4">
        <p className="font-heading text-lg text-foreground">ProcureMaster</p>
        <p className="text-xs text-muted-foreground">Shared by {report.orgName} · read-only</p>
      </header>
      <main className="mx-auto max-w-6xl px-8 py-8">
        <ReportView report={report} />
      </main>
    </div>
  )
}
