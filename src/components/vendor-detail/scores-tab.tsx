'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import type { ColumnDef } from '@tanstack/react-table'
import { AlertCircle, Loader2, Pencil } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { DataTable } from '@/components/data-table/data-table'
import { AiSparkles } from '@/components/evaluation/ai-marker'
import { scoreTone } from '@/components/evaluation/score'
import { FormField, fieldA11y } from '@/components/forms/form-field'
import { SubmitButton } from '@/components/forms/submit-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/status-badge'
import { Textarea } from '@/components/ui/textarea'
import type { CriterionView, EvaluationView, ScoreView } from '@/lib/evaluation'
import { ApiError } from '@/lib/fetch-json'
import { useEvaluation, useOverrideScore, useStartScoring } from '@/lib/queries/evaluation'
import { overrideSchema, type OverrideRequest } from '@/lib/schemas/evaluation'

type ScoresTabProps = { rfpId: string; vendorAccountId: string; initialData: EvaluationView; locked: boolean }
type Row = { criterion: CriterionView; score: ScoreView | undefined }

// App Flow §4 Tab 2 — Scores: before scoring a fixed message; after scoring each criterion with
// AI score (0–10), weight, weighted score and the AI reasoning; "Override" opens an inline score +
// justification editor; colour-coded weighted total. Both AI and override values are kept.
export function ScoresTab({ rfpId, vendorAccountId, initialData, locked }: ScoresTabProps) {
  const { data: evaluation } = useEvaluation(rfpId, initialData)
  const rescore = useStartScoring(rfpId)
  const [editing, setEditing] = useState<string | null>(null)
  const vendor = evaluation.vendors.find((v) => v.vendorAccountId === vendorAccountId)
  const hasScores = Boolean(vendor?.scores.length)

  // criteria_pending also covers re-confirmed criteria awaiting a new run (old scores are gone).
  if (!evaluation.criteriaConfirmedAt || evaluation.scoringRunCount === 0 || evaluation.status === 'not_started' || evaluation.status === 'criteria_pending' || !vendor) {
    return <p className="text-sm text-muted-foreground">Scoring has not started for this RFP. Start evaluation from the RFP page.</p>
  }
  if (evaluation.status === 'scoring_in_progress' && !hasScores) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="size-4 text-primary motion-safe:animate-spin" aria-hidden="true" />
        Scoring in progress…
      </p>
    )
  }
  if (!hasScores) {
    return (
      <div role="alert" className="flex items-center gap-2 rounded bg-status-danger px-3 py-2 text-status-danger-foreground">
        <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
        <span className="text-sm">Scoring failed for this vendor.</span>
        {!locked && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-xs"
            disabled={rescore.isPending}
            onClick={async () => {
              try {
                await rescore.mutateAsync({ evaluationId: evaluation.id, vendorAccountId })
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'We could not retry scoring.', { duration: 6000 })
              }
            }}
          >
            Retry scoring
          </Button>
        )}
      </div>
    )
  }

  const rows: Row[] = evaluation.criteria.map((c) => ({ criterion: c, score: vendor.scores.find((s) => s.criterionId === c.id) }))
  const columns: ColumnDef<Row, unknown>[] = [
    { id: 'criterion', header: 'Criterion', cell: ({ row }) => <span className="font-medium">{row.original.criterion.name}</span> },
    { id: 'weight', header: 'Weight', cell: ({ row }) => `${row.original.criterion.weight}%` },
    {
      id: 'score',
      header: 'Score',
      cell: ({ row }) => {
        const s = row.original.score
        if (!s) return '—'
        if (s.overrideScore !== null) {
          return (
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{s.overrideScore.toFixed(1)}</span>
              <StatusBadge tone="neutral">Overridden</StatusBadge>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <AiSparkles />
                AI {s.aiScore?.toFixed(1) ?? '—'}
              </span>
            </span>
          )
        }
        return (
          <span className="flex items-center gap-1.5 font-medium">
            <AiSparkles />
            {s.aiScore?.toFixed(1) ?? '—'}
          </span>
        )
      },
    },
    {
      id: 'weighted',
      header: 'Weighted',
      cell: ({ row }) => {
        const s = row.original.score?.effectiveScore
        return s === null || s === undefined ? '—' : ((s * row.original.criterion.weight) / 100).toFixed(2)
      },
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) =>
        locked || !row.original.score ? null : (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" aria-expanded={editing === row.original.criterion.id} onClick={() => setEditing((e) => (e === row.original.criterion.id ? null : row.original.criterion.id))}>
              <Pencil aria-hidden="true" />
              Override
            </Button>
          </div>
        ),
    },
  ]

  const subRow = ({ criterion, score }: Row) => {
    if (!score) return null
    return (
      <div className="space-y-3">
        {score.aiReasoning && <p className="max-w-prose text-sm text-muted-foreground">{score.aiReasoning}</p>}
        {score.overrideJustification && (
          <p className="max-w-prose text-sm text-foreground">
            <span className="font-medium">Override justification: </span>
            {score.overrideJustification}
          </p>
        )}
        {editing === criterion.id && <OverrideForm rfpId={rfpId} score={score} criterionName={criterion.name} onDone={() => setEditing(null)} />}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {evaluation.status === 'scoring_in_progress' && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 text-primary motion-safe:animate-spin" aria-hidden="true" />
          Scoring in progress…
        </p>
      )}
      <DataTable columns={columns} data={rows} label="Scores by criterion" renderSubRow={subRow} />
      <div className="flex items-center justify-end gap-3">
        <span className="text-sm font-medium text-foreground">Total weighted score</span>
        {vendor.total === null ? (
          <span className="text-sm text-muted-foreground">—</span>
        ) : (
          <StatusBadge tone={scoreTone(vendor.total)} className="text-sm" data-testid="vendor-total">
            {vendor.total.toFixed(2)} / 10
          </StatusBadge>
        )}
      </div>
    </div>
  )
}

function OverrideForm({ rfpId, score, criterionName, onDone }: { rfpId: string; score: ScoreView; criterionName: string; onDone: () => void }) {
  const override = useOverrideScore(rfpId)
  const form = useForm<OverrideRequest>({
    resolver: zodResolver(overrideSchema),
    defaultValues: { score: score.overrideScore ?? score.aiScore ?? 0, justification: score.overrideJustification ?? '' },
  })
  const { errors, isSubmitting } = form.formState
  const id = `override-${score.id}`

  const submit = form.handleSubmit(async (values) => {
    try {
      await override.mutateAsync({ scoreId: score.id, ...values })
      toast.success(`Score for ${criterionName} overridden`, { duration: 4000 })
      onDone()
    } catch (err) {
      const fields = err instanceof ApiError ? err.body.fields : undefined
      if (fields?.score?.[0]) return form.setError('score', { message: fields.score[0] })
      if (fields?.justification?.[0]) return form.setError('justification', { message: fields.justification[0] })
      form.setError('root', { message: err instanceof Error ? err.message : 'We could not save the override.' })
    }
  })

  return (
    <form method="post" onSubmit={submit} noValidate className="grid max-w-2xl grid-cols-[8rem_1fr] items-start gap-4 rounded border border-border p-4">
      <FormField id={`${id}-score`} label="Score (0–10)" required error={errors.score?.message}>
        <Input type="number" step="0.1" min={0} max={10} inputMode="decimal" {...fieldA11y(`${id}-score`, errors.score?.message)} {...form.register('score')} />
      </FormField>
      <FormField id={`${id}-why`} label="Justification" required error={errors.justification?.message}>
        <Textarea className="min-h-[72px] resize-y rounded" {...fieldA11y(`${id}-why`, errors.justification?.message)} {...form.register('justification')} />
      </FormField>
      <div className="col-span-2 flex items-center justify-end gap-3">
        {errors.root?.message && (
          <p role="alert" className="mr-auto flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="size-3" aria-hidden="true" />
            {errors.root.message}
          </p>
        )}
        <Button type="button" variant="outline" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <SubmitButton size="sm" pending={isSubmitting} pendingLabel="Saving override">
          Save
        </SubmitButton>
      </div>
    </form>
  )
}
