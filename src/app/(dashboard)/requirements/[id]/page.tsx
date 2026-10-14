import { format } from 'date-fns'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Breadcrumb } from '@/components/layout/breadcrumb'
import { PageContainer, PageHeader } from '@/components/layout/page-header'
import { CreateRfpFromRequirement } from '@/components/requirements/create-rfp-from-requirement'
import { StatusBadge } from '@/components/ui/status-badge'
import { getShellUser } from '@/lib/auth/current-user'
import { PRIORITY_LABEL, REQUIREMENT_STATUS_LABEL, REQUIREMENT_STATUS_TONE } from '@/lib/requirements'
import { formatMoney } from '@/lib/rfps'
import { isoToDateInput } from '@/lib/schemas/rfp'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Requirement — ProcureMaster' }

type RequirementPageProps = { params: Promise<{ id: string }> }

// App Flow §5 Requirement Detail (DH own / PM read). Phase 5 adds the PM "Create RFP" action
// (decision P5-2); the DH comment and edit features arrive in Phase 8. RLS limits a DH to
// their own requirements.
export default async function RequirementPage({ params }: RequirementPageProps) {
  const { id } = await params
  const user = await getShellUser()
  const supabase = await createClient()
  const { data: req } = await supabase
    .from('requirements')
    .select('id, title, description, department, budget_estimate, required_by, priority, status, linked_rfp_id, created_at, profiles!requirements_raised_by_fkey(full_name), organisations(currency)')
    .eq('id', id)
    .eq('is_deleted', false)
    .maybeSingle()
  if (!req || !user) notFound()

  const currency = req.organisations?.currency ?? 'USD'
  const isPm = user.role === 'procurement_manager'
  const canCreateRfp = isPm && req.status === 'submitted' && !req.linked_rfp_id

  let departments: string[] = []
  if (canCreateRfp) {
    const { data } = await supabase.from('rfps').select('department').eq('is_deleted', false)
    departments = [...new Set([req.department, ...(data ?? []).map((d) => d.department)])].sort((a, b) => a.localeCompare(b))
  }

  const rfpHref = req.linked_rfp_id ? (isPm ? `/pipeline/rfp/${req.linked_rfp_id}` : `/pipeline/rfp/${req.linked_rfp_id}/report`) : null

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
                  <Link href={rfpHref} className="font-medium text-primary hover:underline">
                    View RFP
                  </Link>
                </dd>
              </>
            )}
          </dl>
          <div>
            <h2 className="mb-1.5 text-sm font-medium text-foreground">Description</h2>
            <p className="max-w-prose whitespace-pre-line text-sm text-muted-foreground">{req.description}</p>
          </div>
        </div>
      </PageContainer>
    </>
  )
}
