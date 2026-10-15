import { format } from 'date-fns'
import { FileText, Pencil } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Breadcrumb } from '@/components/layout/breadcrumb'
import { PageContainer, PageHeader } from '@/components/layout/page-header'
import { ReportComments } from '@/components/report/report-comments'
import { CreateRfpFromRequirement } from '@/components/requirements/create-rfp-from-requirement'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { getShellUser } from '@/lib/auth/current-user'
import { loadReportComments } from '@/lib/report-comments'
import { PRIORITY_LABEL, REQUIREMENT_STATUS_LABEL, REQUIREMENT_STATUS_TONE } from '@/lib/requirements'
import { formatMoney } from '@/lib/rfps'
import { isoToDateInput } from '@/lib/schemas/rfp'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Requirement — ProcureMaster' }

type RequirementPageProps = { params: Promise<{ id: string }> }

const formatSize = (bytes: number) => (bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)

// App Flow §5 Requirement Detail (DH own / PM read): all fields, status, submission time,
// linked RFP (DH → read-only report), attachments (P8-4), the DH's recommendation comments on
// the report (P8-3), Edit while Draft / Submitted. PM: "Create RFP" (decision P5-2).
export default async function RequirementPage({ params }: RequirementPageProps) {
  const { id } = await params
  const user = await getShellUser()
  const supabase = await createClient()
  const { data: req } = await supabase
    .from('requirements')
    .select(
      'id, title, description, department, budget_estimate, required_by, priority, status, linked_rfp_id, raised_by, created_at, profiles!requirements_raised_by_fkey(full_name), organisations(currency), requirement_attachments(id, file_name, file_size_bytes, created_at)'
    )
    .eq('id', id)
    .eq('is_deleted', false)
    .maybeSingle()
  if (!req || !user) notFound()

  const currency = req.organisations?.currency ?? 'USD'
  const isPm = user.role === 'procurement_manager'
  const isOwner = user.role === 'department_head' && req.raised_by === user.id
  const canCreateRfp = isPm && req.status === 'submitted' && !req.linked_rfp_id
  const canEdit = isOwner && ['draft', 'submitted'].includes(req.status) && !req.linked_rfp_id

  let departments: string[] = []
  if (canCreateRfp) {
    const { data } = await supabase.from('rfps').select('department').eq('is_deleted', false)
    departments = [...new Set([req.department, ...(data ?? []).map((d) => d.department)])].sort((a, b) => a.localeCompare(b))
  }

  // Linked RFP's report (RLS: the DH can read it once the PM linked the RFP to this requirement).
  let reportReady = false
  let comments: Awaited<ReturnType<typeof loadReportComments>> = []
  if (req.linked_rfp_id) {
    const { data: evaluation } = await supabase.from('evaluations').select('report_generated_at').eq('rfp_id', req.linked_rfp_id).maybeSingle()
    reportReady = Boolean(evaluation?.report_generated_at)
    if (reportReady) comments = await loadReportComments(supabase, req.linked_rfp_id)
  }
  const rfpHref = req.linked_rfp_id ? (isPm ? `/pipeline/rfp/${req.linked_rfp_id}` : `/pipeline/rfp/${req.linked_rfp_id}/report`) : null
  const attachments = [...req.requirement_attachments].sort((a, b) => a.created_at.localeCompare(b.created_at))

  return (
    <>
      <Breadcrumb items={[{ label: 'Requirements', href: '/requirements' }, { label: req.title }]} />
      <PageContainer>
        <PageHeader
          title={req.title}
          description={`Raised by ${req.profiles?.full_name ?? 'unknown'} on ${format(new Date(req.created_at), 'd MMM yyyy, HH:mm')}`}
          action={
            canCreateRfp ? (
              <CreateRfpFromRequirement
                departments={departments}
                currency={currency}
                defaults={{
                  title: req.title,
                  description: req.description,
                  department: req.department,
                  budgetMax: req.budget_estimate,
                  submissionDeadline: req.required_by ? isoToDateInput(`${req.required_by}T12:00:00`) : '',
                  requirementId: req.id,
                }}
              />
            ) : canEdit ? (
              <Button variant="outline" asChild>
                <Link href={`/requirements/${id}/edit`}>
                  <Pencil aria-hidden="true" />
                  Edit
                </Link>
              </Button>
            ) : undefined
          }
        />
        <div className="max-w-2xl space-y-6">
          <StatusBadge tone={REQUIREMENT_STATUS_TONE[req.status]} data-testid="requirement-status">
            {REQUIREMENT_STATUS_LABEL[req.status]}
          </StatusBadge>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Department</dt>
            <dd className="text-foreground">{req.department}</dd>
            <dt className="text-muted-foreground">Priority</dt>
            <dd className="text-foreground">{PRIORITY_LABEL[req.priority]}</dd>
            <dt className="text-muted-foreground">Estimated budget</dt>
            <dd className="text-foreground">{formatMoney(req.budget_estimate, currency)}</dd>
            <dt className="text-muted-foreground">Required delivery date</dt>
            <dd className="text-foreground">{req.required_by ? format(new Date(`${req.required_by}T12:00:00`), 'd MMM yyyy') : '—'}</dd>
            {rfpHref && (
              <>
                <dt className="text-muted-foreground">Linked RFP</dt>
                <dd>
                  {isPm || reportReady ? (
                    <Link href={rfpHref} className="font-medium text-primary hover:underline">
                      {isPm ? 'View RFP' : 'View comparison report'}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Evaluation in progress</span>
                  )}
                </dd>
              </>
            )}
          </dl>
          <div>
            <h2 className="mb-1.5 text-sm font-medium text-foreground">Description</h2>
            <p className="max-w-prose whitespace-pre-line text-sm text-muted-foreground">{req.description}</p>
          </div>
          {attachments.length > 0 && (
            <div>
              <h2 className="mb-1.5 text-sm font-medium text-foreground">Attachments</h2>
              <ul className="space-y-1.5" aria-label="Attachments">
                {attachments.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 text-sm">
                    <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
                    <a href={`/api/requirements/${id}/attachments/${a.id}`} className="font-medium text-primary hover:underline" download>
                      {a.file_name}
                    </a>
                    <span className="text-xs text-muted-foreground">{formatSize(a.file_size_bytes)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        {req.linked_rfp_id && reportReady && (
          <div className="mt-10">
            <ReportComments rfpId={req.linked_rfp_id} initialComments={comments} canComment={isOwner} />
          </div>
        )}
      </PageContainer>
    </>
  )
}
