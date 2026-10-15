'use client'

import { format } from 'date-fns'
import { AlertCircle, Archive, FileBarChart, Loader2, Pencil, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { SubmitForApproval, type ApprovalOption, type PendingApproval } from '@/components/approvals/submit-for-approval'
import { CriteriaDialog } from '@/components/evaluation/criteria-dialog'
import { ConfirmDialog } from '@/components/rfps/confirm-dialog'
import { InviteVendorDialog } from '@/components/rfps/invite-vendor-dialog'
import { RfpFormDialog } from '@/components/rfps/rfp-form-dialog'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { fetchJson } from '@/lib/fetch-json'
import { useGenerateReport } from '@/lib/queries/evaluation'
import { formatBudget, type RfpDetail } from '@/lib/rfps'
import { isoToDateInput } from '@/lib/schemas/rfp'
import { RFP_STATUS_LABEL, RFP_STATUS_TONE } from '@/lib/status'

type RfpDetailPanelProps = {
  detail: RfpDetail
  departments: string[]
  /** Phase 8: Submit for Approval / pending state, once the report exists. */
  approval: { shortlisted: ApprovalOption[]; approvers: ApprovalOption[]; pending: PendingApproval | null } | null
}

const DESCRIPTION_PREVIEW = 280
const INVITABLE = ['requirements_received', 'rfp_created', 'vendors_invited', 'submissions_in', 'under_evaluation']
const EVALUATION_LOCKED = ['approval_pending', 'contracted', 'archived']
const POLL_MS = 5_000

// App Flow §4 RFP Detail — left panel: inline-editable title, status, department, budget,
// deadline, collapsible description, actions. Start Evaluation (>= 1 submission) opens the
// criteria modal; Generate Report appears once scoring is complete; Submit for Approval once the
// report exists and a vendor is shortlisted (P8-1).
export function RfpDetailPanel({ detail, departments, approval }: RfpDetailPanelProps) {
  const router = useRouter()
  const { rfp, currency } = detail
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState(rfp.title)
  const [expanded, setExpanded] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [criteriaOpen, setCriteriaOpen] = useState(false)
  const archived = rfp.status === 'archived'
  const canInvite = INVITABLE.includes(rfp.status)
  const evaluationLocked = EVALUATION_LOCKED.includes(rfp.status)
  const scoring = detail.evaluationStatus === 'scoring_in_progress'

  // Scoring runs in the background (Tech Stack §11.1): refresh until it completes.
  useEffect(() => {
    if (!scoring) return
    const timer = setInterval(() => router.refresh(), POLL_MS)
    return () => clearInterval(timer)
  }, [scoring, router])

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

      {approval && (
        <SubmitForApproval
          rfpId={rfp.id}
          shortlisted={approval.shortlisted}
          approvers={approval.approvers}
          recommendedVendorId={null}
          pending={approval.pending}
          eligible={!evaluationLocked}
          fullWidth
        />
      )}
      {detail.evaluation?.reportGeneratedAt && (
        <Button variant="outline" className="w-full" asChild>
          <Link href={`/pipeline/rfp/${rfp.id}/report`}>
            <FileBarChart aria-hidden="true" />
            View Report
          </Link>
        </Button>
      )}

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
          {!evaluationLocked && (
            <StartEvaluationButton submittedCount={detail.submittedCount} scoring={scoring} onStart={() => setCriteriaOpen(true)} />
          )}
          {!evaluationLocked && (detail.evaluationStatus === 'scored' || detail.evaluationStatus === 'report_generated') && detail.evaluation && (
            <GenerateReportButton rfpId={rfp.id} evaluationId={detail.evaluation.id} regenerate={Boolean(detail.evaluation.reportGeneratedAt)} />
          )}
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
      {detail.evaluation && (
        <CriteriaDialog
          rfpId={rfp.id}
          evaluationId={detail.evaluation.id}
          existing={detail.evaluation.criteria}
          open={criteriaOpen}
          onOpenChange={setCriteriaOpen}
          onStarted={() => router.refresh()}
        />
      )}
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

// App Flow §4: visible once a vendor has submitted; otherwise disabled with a tooltip. Opens the
// criteria modal; while AI scoring runs it shows progress instead.
function StartEvaluationButton({ submittedCount, scoring, onStart }: { submittedCount: number; scoring: boolean; onStart: () => void }) {
  if (scoring) {
    return (
      <Button className="w-full" disabled aria-busy="true">
        <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />
        Scoring in progress…
      </Button>
    )
  }
  if (submittedCount > 0) {
    return (
      <Button className="w-full" onClick={onStart}>
        Start Evaluation
      </Button>
    )
  }
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* span wrapper: a disabled button doesn't fire the events the tooltip needs */}
          <span tabIndex={0} className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Button className="w-full" disabled aria-disabled="true">
              Start Evaluation
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Available once at least one vendor has submitted.</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// App Flow §4: "Generate Report" appears once scoring is complete. Synchronous AI call; a failure
// is shown inline with Retry (CLAUDE.md AI pipeline).
function GenerateReportButton({ rfpId, evaluationId, regenerate }: { rfpId: string; evaluationId: string; regenerate: boolean }) {
  const router = useRouter()
  const generate = useGenerateReport()
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    setError(null)
    try {
      await generate.mutateAsync(evaluationId)
      toast.success('Report generated', { duration: 4000 })
      router.push(`/pipeline/rfp/${rfpId}/report`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The report could not be generated.')
    }
  }

  return (
    <div className="space-y-2">
      <Button className="w-full" variant={regenerate ? 'outline' : 'default'} disabled={generate.isPending} aria-busy={generate.isPending || undefined} onClick={run}>
        {generate.isPending && <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />}
        {generate.isPending ? 'Generating report…' : regenerate ? 'Regenerate Report' : 'Generate Report'}
      </Button>
      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="size-3 shrink-0" aria-hidden="true" />
          {error}
          <Button variant="ghost" size="sm" className="h-auto px-1 py-0 text-xs" onClick={run}>
            Retry
          </Button>
        </p>
      )}
    </div>
  )
}
