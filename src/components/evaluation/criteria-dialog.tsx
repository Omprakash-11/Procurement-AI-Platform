'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Loader2, Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { AiSparkles } from '@/components/evaluation/ai-marker'
import { SubmitButton } from '@/components/forms/submit-button'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { CriterionView } from '@/lib/evaluation'
import { useSaveCriteria, useStartScoring, useSuggestCriteria, useTemplates } from '@/lib/queries/evaluation'
import { criterionInputSchema, totalIs100 } from '@/lib/schemas/evaluation'
import { cn } from '@/lib/utils'

type CriteriaDialogProps = {
  rfpId: string
  evaluationId: string
  /** Criteria already confirmed for this RFP (re-scoring starts from them). */
  existing: CriterionView[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onStarted: () => void
}

const formSchema = z.object({ criteria: z.array(criterionInputSchema).min(1, 'Add at least one criterion.').max(20, 'Use at most 20 criteria.') })
type FormValues = z.input<typeof formSchema>
type Row = FormValues['criteria'][number]

const NO_TEMPLATE = '__none__'

// App Flow §4 Evaluation Setup — full-screen modal "Review AI-Suggested Scoring Criteria": editable
// names and weights, remove (×), "Add Criterion", running total (must be exactly 100), "Confirm
// and Start Scoring" | "Cancel". Decision P4-8: org scoring templates can replace the list.
export function CriteriaDialog({ rfpId, evaluationId, existing, open, onOpenChange, onStarted }: CriteriaDialogProps) {
  const suggest = useSuggestCriteria(rfpId)
  const save = useSaveCriteria(rfpId)
  const score = useStartScoring(rfpId)
  const templates = useTemplates(open)
  const [templateId, setTemplateId] = useState<string>(NO_TEMPLATE)
  const [suggestError, setSuggestError] = useState<string | null>(null)

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { criteria: [] } })
  const { fields, append, remove, replace } = useFieldArray({ control: form.control, name: 'criteria' })
  const { errors, isSubmitting } = form.formState
  const values = form.watch('criteria')
  const total = Math.round(values.reduce((s, c) => s + (Number(c.weight) || 0), 0) * 100) / 100
  const totalOk = values.length > 0 && totalIs100(values.map((c) => ({ weight: Number(c.weight) || 0 })))

  const runSuggest = async () => {
    setSuggestError(null)
    try {
      const criteria = await suggest.mutateAsync()
      replace(criteria.map((c) => ({ name: c.name, description: c.description ?? null, weight: c.weight, isAiSuggested: true })))
      setTemplateId(NO_TEMPLATE)
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : 'The AI could not suggest criteria.')
    }
  }

  useEffect(() => {
    if (!open) return
    setSuggestError(null)
    setTemplateId(NO_TEMPLATE)
    if (existing.length) {
      form.reset({ criteria: existing.map((c) => ({ name: c.name, description: c.description, weight: c.weight, isAiSuggested: c.isAiSuggested })) })
    } else {
      form.reset({ criteria: [] })
      void runSuggest()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the modal opens
  }, [open])

  const applyTemplate = (id: string) => {
    setTemplateId(id)
    const template = templates.data?.find((t) => t.id === id)
    if (template) replace(template.criteria.map((c) => ({ name: c.name, description: c.description, weight: c.weight, isAiSuggested: false })))
  }

  const submit = form.handleSubmit(async ({ criteria }) => {
    if (!totalIs100(criteria.map((c) => ({ weight: Number(c.weight) })))) return
    try {
      await save.mutateAsync({
        criteria: criteria.map((c) => ({ name: c.name, description: c.description ?? null, weight: Number(c.weight), isAiSuggested: c.isAiSuggested ?? false })),
        templateId: templateId === NO_TEMPLATE ? null : templateId,
      })
      await score.mutateAsync({ evaluationId })
      onOpenChange(false)
      toast.success('Scoring started — you will be notified when it completes', { duration: 4000 })
      onStarted()
    } catch (err) {
      form.setError('root', { message: err instanceof Error ? err.message : 'We could not start scoring.' })
    }
  })

  const loading = suggest.isPending && fields.length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] max-w-none flex-col gap-0 rounded-none p-0 sm:rounded-none">
        <DialogHeader className="border-b border-border px-8 py-6">
          <DialogTitle className="font-heading text-2xl">Review AI-Suggested Scoring Criteria</DialogTitle>
          <DialogDescription>
            The AI has analysed submitted documents and suggested the following criteria. Review, adjust weights, add or remove criteria before scoring begins.
          </DialogDescription>
        </DialogHeader>

        <form method="post" onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
            <div className="mx-auto max-w-3xl space-y-6">
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-72">
                  <Label htmlFor="criteria-template" className="mb-1.5 block text-sm font-medium">
                    Start from a template
                  </Label>
                  <Select value={templateId} onValueChange={applyTemplate} disabled={!templates.data?.length}>
                    <SelectTrigger id="criteria-template">
                      <SelectValue placeholder="No template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_TEMPLATE}>No template</SelectItem>
                      {templates.data?.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" variant="outline" disabled={suggest.isPending} aria-busy={suggest.isPending || undefined} onClick={runSuggest}>
                  {suggest.isPending && <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />}
                  Suggest with AI
                </Button>
              </div>

              {suggestError && (
                <div role="alert" className="flex items-center gap-2 rounded bg-status-danger px-3 py-2 text-sm text-status-danger-foreground">
                  <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                  {suggestError}
                  <Button type="button" variant="ghost" size="sm" className="ml-auto text-xs" onClick={runSuggest}>
                    Retry
                  </Button>
                </div>
              )}

              {loading ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                  <Loader2 className="size-4 text-primary motion-safe:animate-spin" aria-hidden="true" />
                  Analysing with AI…
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-[1fr_8rem_2.25rem] gap-3 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <span>Criterion</span>
                    <span>Weight (%)</span>
                    <span className="sr-only">Remove</span>
                  </div>
                  <ol className="space-y-2" aria-label="Scoring criteria">
                    {fields.map((field, i) => {
                      const rowErrors = errors.criteria?.[i]
                      const ai = (values[i] as Row | undefined)?.isAiSuggested
                      return (
                        <li key={field.id} className="grid grid-cols-[1fr_8rem_2.25rem] items-start gap-3">
                          <div>
                            <div className="relative">
                              {ai && <AiSparkles className="absolute left-3 top-1/2 -translate-y-1/2" />}
                              <Input
                                aria-label={`Criterion ${i + 1} name`}
                                aria-invalid={rowErrors?.name ? true : undefined}
                                className={cn(ai && 'pl-8')}
                                {...form.register(`criteria.${i}.name`)}
                              />
                            </div>
                            {rowErrors?.name?.message && <p className="mt-1 text-xs text-destructive">{rowErrors.name.message}</p>}
                          </div>
                          <div>
                            <Input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              max={100}
                              step="0.01"
                              aria-label={`Criterion ${i + 1} weight`}
                              aria-invalid={rowErrors?.weight ? true : undefined}
                              {...form.register(`criteria.${i}.weight`)}
                            />
                            {rowErrors?.weight?.message && <p className="mt-1 text-xs text-destructive">{rowErrors.weight.message}</p>}
                          </div>
                          <Button type="button" variant="ghost" size="icon" aria-label={`Remove criterion ${i + 1}`} onClick={() => remove(i)}>
                            <X />
                          </Button>
                        </li>
                      )
                    })}
                  </ol>
                  <Button type="button" variant="outline" size="sm" onClick={() => append({ name: '', description: null, weight: 0, isAiSuggested: false })}>
                    <Plus aria-hidden="true" />
                    Add Criterion
                  </Button>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="items-center gap-3 border-t border-border px-8 py-4">
            <p className={cn('mr-auto text-sm font-medium', totalOk ? 'text-foreground' : 'text-destructive')} aria-live="polite" data-testid="criteria-total">
              Total: {total}% {totalOk ? '' : '— must equal 100%'}
            </p>
            {(errors.root?.message || errors.criteria?.message || errors.criteria?.root?.message) && (
              <p role="alert" className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="size-3" aria-hidden="true" />
                {errors.root?.message ?? errors.criteria?.message ?? errors.criteria?.root?.message}
              </p>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <SubmitButton pending={isSubmitting} pendingLabel="Starting scoring" disabled={!totalOk || loading}>
              Confirm and Start Scoring
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
