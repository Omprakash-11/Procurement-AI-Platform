import { logActivity } from '@/lib/activity'
import { apiError, requireUser, withErrors } from '@/lib/api'
import { loadReport } from '@/lib/evaluation'
import { htmlToPdf } from '@/lib/reports/pdf'
import { reportHtml } from '@/lib/reports/pdf-html'

export const maxDuration = 60

type Params = { params: Promise<{ rfpId: string }> }

// POST /api/reports/[rfpId]/export — Backend Schema §8.5 / Tech Stack §10.1: report data →
// HTML template → Puppeteer → PDF download. PM only. Data is read with the PM's client (RLS).
export const POST = withErrors(async function POST(_request: Request, { params }: Params) {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response
  const { rfpId } = await params
  const report = await loadReport(auth.supabase, rfpId)
  if (!report || !report.evaluation.reportGeneratedAt) return apiError(404, 'not_found', 'Report not found.')

  let pdf: Uint8Array
  try {
    pdf = await htmlToPdf(reportHtml(report))
  } catch (err) {
    console.error('PDF export failed', err)
    return apiError(500, 'export_failed', 'We could not create the PDF. Please try again.')
  }

  const { data: rfp } = await auth.supabase.from('rfps').select('org_id').eq('id', rfpId).single()
  if (rfp) {
    await logActivity({
      orgId: rfp.org_id,
      actorId: auth.userId,
      actorType: 'profile',
      entityType: 'rfp',
      entityId: rfpId,
      action: 'report.exported',
      description: `Comparison report for "${report.rfp.title}" exported as PDF`,
      metadata: { rfp_id: rfpId },
    })
  }

  const fileName = `${report.rfp.title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 80) || 'report'}-comparison-report.pdf`
  return new Response(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
})
