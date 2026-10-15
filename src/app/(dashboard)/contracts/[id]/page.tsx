import { format } from 'date-fns'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ActivityFeed } from '@/components/activity/activity-feed'
import { AlertDaysEditor, ContractActions, ContractDocument } from '@/components/contracts/contract-actions'
import { DaysRemaining } from '@/components/contracts/contracts-table'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { PageContainer, PageHeader } from '@/components/layout/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TONE, loadContract } from '@/lib/contracts'
import { formatMoney } from '@/lib/rfps'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Contract — ProcureMaster' }

type ContractPageProps = { params: Promise<{ id: string }> }

const date = (d: string) => format(new Date(`${d}T12:00:00`), 'd MMM yyyy')

// App Flow §4 Contract Detail (PM): vendor, linked RFP, value, payment terms, dates, alert
// threshold (inline edit), document (download / upload), activity, Mark as Terminated,
// Initiate Renewal.
export default async function ContractPage({ params }: ContractPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const contract = await loadContract(supabase, id)
  if (!contract) notFound()
  const [{ data: rfpDepts }, { data: reqDepts }] = await Promise.all([
    supabase.from('rfps').select('department').eq('is_deleted', false),
    supabase.from('requirements').select('department').eq('is_deleted', false),
  ])
  const departments = [...new Set([...(rfpDepts ?? []), ...(reqDepts ?? [])].map((d) => d.department))].sort((a, b) => a.localeCompare(b))
  const terminated = contract.status === 'terminated'

  return (
    <>
      <Breadcrumb items={[{ label: 'Contracts', href: '/contracts' }, { label: contract.title }]} />
      <PageContainer>
        <PageHeader
          title={contract.title}
          description={`${contract.vendorName} · ${contract.rfpTitle}`}
          action={
            <StatusBadge tone={CONTRACT_STATUS_TONE[contract.status]} data-testid="contract-status">
              {CONTRACT_STATUS_LABEL[contract.status]}
            </StatusBadge>
          }
        />
        <div className="space-y-10">
          <ContractActions contract={contract} departments={departments} />
          <dl className="grid max-w-2xl grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
            <dt className="text-muted-foreground">Vendor</dt>
            <dd className="text-foreground">{contract.vendorName}</dd>
            <dt className="text-muted-foreground">Linked RFP</dt>
            <dd>
              <Link href={`/pipeline/rfp/${contract.rfpId}`} className="font-medium text-primary hover:underline">
                {contract.rfpTitle}
              </Link>
            </dd>
            <dt className="text-muted-foreground">Contract value</dt>
            <dd className="text-foreground" data-testid="contract-value">
              {formatMoney(contract.value, contract.currency)}
            </dd>
            <dt className="text-muted-foreground">Payment terms</dt>
            <dd className="whitespace-pre-line text-foreground">{contract.paymentTerms ?? '—'}</dd>
            <dt className="text-muted-foreground">Start date</dt>
            <dd className="text-foreground">{date(contract.startDate)}</dd>
            <dt className="text-muted-foreground">End date</dt>
            <dd className="flex items-center gap-2 text-foreground">
              {date(contract.endDate)} <DaysRemaining row={contract} />
            </dd>
            <dt className="text-muted-foreground">Renewal alert</dt>
            <dd>
              <AlertDaysEditor contractId={contract.id} value={contract.alertDays} disabled={terminated} />
            </dd>
            {terminated && (
              <>
                <dt className="text-muted-foreground">Terminated</dt>
                <dd className="text-foreground" data-testid="termination">
                  {contract.terminatedAt ? format(new Date(contract.terminatedAt), 'd MMM yyyy') : ''} — {contract.terminationReason}
                </dd>
              </>
            )}
          </dl>
          <section aria-labelledby="contract-document" className="space-y-3">
            <h2 id="contract-document" className="text-xl font-semibold text-foreground">
              Contract document
            </h2>
            <ContractDocument contract={contract} />
          </section>
          <section aria-labelledby="contract-activity" className="max-w-3xl space-y-3">
            <h2 id="contract-activity" className="text-xl font-semibold text-foreground">
              Activity
            </h2>
            <ActivityFeed scope={{ contractId: contract.id }} label="Contract activity" />
          </section>
        </div>
      </PageContainer>
    </>
  )
}
