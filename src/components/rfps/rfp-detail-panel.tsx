'use client'

import { format } from 'date-fns'
import { Archive, Pencil, UserPlus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/rfps/confirm-dialog'
import { InviteVendorDialog } from '@/components/rfps/invite-vendor-dialog'
import { RfpFormDialog } from '@/components/rfps/rfp-form-dialog'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { fetchJson } from '@/lib/fetch-json'
import { formatBudget, type RfpDetail } from '@/lib/rfps'
import { isoToDateInput } from '@/lib/schemas/rfp'
import { RFP_STATUS_LABEL, RFP_STATUS_TONE } from '@/lib/status'

type RfpDetailPanelProps = { detail: RfpDetail; departments: string[] }

const DESCRIPTION_PREVIEW = 280
const INVITABLE = ['requirements_received', 'rfp_created', 'vendors_invited', 'submissions_in', 'under_evaluation']

// App Flow §4 RFP Detail — left panel: inline-editable title, status, department, budget,
// deadline, collapsible description, actions. Start Evaluation / Generate Report / Submit for
// Approval follow their App Flow visibility rules; their actions arrive in Phases 7–8.
export function RfpDetailPanel({ detail, departments }: RfpDetailPanelProps) {
  const router = useRouter()
  const { rfp, currency } = detail
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState(rfp.title)
  const [expanded, setExpanded] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const archived = rfp.status === 'archived'
  const canInvite = INVITABLE.includes(rfp.status)

  const patch = (body: object) => fetchJson(`/api/rfps/${rfp.id}`, { method: 'PATCH', body: JSON.stringify(body) })

  const saveTitle = async () => {
    const next = title.trim()
    setEditingTitle(false)
    if (!next || next === rfp.title) return setTitle(rfp.title)
    try {
      await patch({ title: next })
      toast.success('RFP updated', { duration: 4000 })
      router.refresh()
    } catch (err) {
      setTitle(rfp.title)
      toast.error(err instanceof Error ? err.message : 'We could not rename the RFP.', { duration: 6000 })
    }
  }

  const longDescription = rfp.description.length > DESCRIPTION_PREVIEW

  return (
    <section aria-label="RFP details" className="space-y-6">
      <div className="space-y-3">
        {editingTitle ? (
          <input
            autoFocus
            aria-label="RFP title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') {
                setTitle(rfp.title)
                setEditingTitle(false)
              }
            }}
            className="w-full rounded border border-input bg-background px-2 py-1 font-heading text-3xl text-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        ) : (
          <h1>
            <button
              type="button"
              disabled={archived}
              onClick={() => setEditingTitle(true)}
              title={archived ? undefined : 'Click to rename'}
              className="rounded text-left font-heading text-3xl text-foreground hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:hover:bg-transparent"
            >
              {title}
            </button>
          </h1>
        )}
        <StatusBadge tone={RFP_STATUS_TONE[rfp.status]} data-testid="rfp-status">
          {RFP_STATUS_LABEL[rfp.status]}
        </StatusBadge>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Department</dt>
        <dd className="text-foreground">{rfp.department}</dd>
        <dt className="text-muted-foreground">Budget</dt>
        <dd className="text-foreground">{formatBudget(rfp.budgetMin, rfp.budgetMax, currency)}</dd>
        <dt className="text-muted-foreground">Submission deadline</dt>
        <dd className="text-foreground">{rfp.submissionDeadline ? format(new Date(rfp.submissionDeadline), 'd MMM yyyy') : '—'}</dd>
      </dl>

      <div>
        <h2 className="mb-1.5 text-sm font-medium text-foreground">Description</h2>
        <p className="max-w-prose whitespace-pre-line text-sm text-muted-foreground">
          {longDescription && !expanded ? `${rfp.description.slice(0, DESCRIPTION_PREVIEW)}…` : rfp.description}
        </p>
        {longDescription && (
          <Button variant="link" size="sm" className="h-auto p-0" aria-expanded={expanded} onClick={() => setExpanded((e) => !e)}>
            {expanded ? 'Show less' : 'Show more'}
          </Button>
        )}
      </div>

      {!archived && (
        <div className="flex flex-col gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil aria-hidden="true" />
            Edit RFP
          </Button>
          {canInvite && (
            <Button variant="outline" onClick={() => setInviteOpen(true)}>
              <UserPlus aria-hidden="true" />
              Invite Vendors
            </Button>
          )}
          <StartEvaluationButton submittedCount={detail.submittedCount} />
          <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setArchiveOpen(true)}>
            <Archive aria-hidden="true" />
            Archive RFP
          </Button>
        </div>
      )}

      <RfpFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        departments={departments}
        currency={currency}
        defaults={{
          title: rfp.title,
          description: rfp.description,
          department: rfp.department,
          budgetMin: rfp.budgetMin,
          budgetMax: rfp.budgetMax,
          submissionDeadline: isoToDateInput(rfp.submissionDeadline),
        }}
        onSubmit={async (body) => {
          await patch({
            title: body.title,
            description: body.description,
            department: body.department,
            budgetMin: body.budgetMin,
            budgetMax: body.budgetMax,
            submissionDeadline: body.submissionDeadline,
          })
          setEditOpen(false)
          setTitle(body.title)
          toast.success('RFP updated', { duration: 4000 })
          router.refresh()
        }}
      />
      <InviteVendorDialog rfpId={rfp.id} open={inviteOpen} onOpenChange={setInviteOpen} onInvited={() => router.refresh()} />
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Archive this RFP?"
        description="It moves to the Archived column and can no longer be edited or receive invites."
        confirmLabel="Archive RFP"
        destructive
        onConfirm={async () => {
          try {
            await patch({ status: 'archived' })
            toast.success('RFP archived', { duration: 4000 })
            router.refresh()
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'We could not archive the RFP.', { duration: 6000 })
          }
        }}
      />
    </section>
  )
}

// App Flow §4: visible once a vendor has submitted; otherwise disabled with a tooltip.
// The evaluation itself (criteria modal + scoring) is built in Phase 7.
function StartEvaluationButton({ submittedCount }: { submittedCount: number }) {
  const ready = submittedCount > 0
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* span wrapper: a disabled button doesn't fire the events the tooltip needs */}
          <span tabIndex={ready ? -1 : 0} className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Button className="w-full" disabled aria-disabled="true">
              Start Evaluation
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{ready ? 'Evaluation becomes available in a later release step.' : 'Available once at least one vendor has submitted.'}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
