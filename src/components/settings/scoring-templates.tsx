'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import type { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import { AlertCircle, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { DataTable } from '@/components/data-table/data-table'
import { FormField, fieldA11y } from '@/components/forms/form-field'
import { SubmitButton } from '@/components/forms/submit-button'
import { ConfirmDialog } from '@/components/rfps/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useDeleteTemplate, useSaveTemplate, useTemplates } from '@/lib/queries/evaluation'
import { criterionInputSchema, totalIs100 } from '@/lib/schemas/evaluation'
import type { ScoringTemplate } from '@/lib/scoring-templates'
import { cn } from '@/lib/utils'

const formSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(120, 'Keep the name under 120 characters.'),
  criteria: z.array(criterionInputSchema).min(1, 'Add at least one criterion.').max(20, 'Use at most 20 criteria.'),
})
type FormValues = z.input<typeof formSchema>

// Decision P4-8: org-level reusable criteria templates (Backend Schema §2.16), used from the
// evaluation criteria modal. PM only. Same weight rule as the modal: exactly 100%.
export function ScoringTemplates() {
  const { data: templates = [], isLoading } = useTemplates()
  const remove = useDeleteTemplate()
  const [editing, setEditing] = useState<ScoringTemplate | 'new' | null>(null)
  const [deleting, setDeleting] = useState<ScoringTemplate | null>(null)

  const columns: ColumnDef<ScoringTemplate, unknown>[] = [
    { accessorKey: 'name', header: 'Name', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { id: 'criteria', header: 'Criteria', cell: ({ row }) => row.original.criteria.map((c) => `${c.name} (${c.weight}%)`).join(', ') },
    { accessorKey: 'lastUsedAt', header: 'Last used', cell: ({ row }) => (row.original.lastUsedAt ? format(new Date(row.original.lastUsedAt), 'd MMM yyyy') : '—') },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" aria-label={`Edit ${row.original.name}`} onClick={() => setEditing(row.original)}>
            <Pencil />
          </Button>
          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" aria-label={`Delete ${row.original.name}`} onClick={() => setDeleting(row.original)}>
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <section aria-label="Scoring templates" className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Scoring templates</h2>
          <p className="text-sm text-muted-foreground">Reusable criteria and weights for vendor evaluations.</p>
        </div>
        <Button onClick={() => setEditing('new')}>
          <Plus aria-hidden="true" />
          New Template
        </Button>
      </div>
      <DataTable columns={columns} data={templates} isLoading={isLoading} label="Scoring templates" />

      <TemplateDialog template={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete "${deleting?.name ?? 'template'}"?`}
        description="It will no longer be offered in the evaluation criteria modal. Past evaluations are not affected."
        confirmLabel="Delete Template"
        destructive
        onConfirm={async () => {
          if (!deleting) return
          try {
            await remove.mutateAsync(deleting.id)
            toast.success('Template deleted', { duration: 4000 })
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'We could not delete the template.', { duration: 6000 })
          }
        }}
      />
    </section>
  )
}

function TemplateDialog({ template, onClose }: { template: ScoringTemplate | 'new' | null; onClose: () => void }) {
  const save = useSaveTemplate()
  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { name: '', criteria: [] } })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'criteria' })
  const { errors, isSubmitting } = form.formState
  const values = form.watch('criteria')
  const total = Math.round(values.reduce((s, c) => s + (Number(c.weight) || 0), 0) * 100) / 100
  const totalOk = values.length > 0 && totalIs100(values.map((c) => ({ weight: Number(c.weight) || 0 })))
  const open = template !== null

  useEffect(() => {
    if (!open) return
    if (template === 'new') form.reset({ name: '', criteria: [{ name: '', description: null, weight: 100, isAiSuggested: false }] })
    else form.reset({ name: template.name, criteria: template.criteria.map((c) => ({ ...c, isAiSuggested: false })) })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when a template is opened
  }, [template])

  const submit = form.handleSubmit(async ({ name, criteria }) => {
    if (!totalIs100(criteria.map((c) => ({ weight: Number(c.weight) })))) return
    try {
      await save.mutateAsync({
        ...(template && template !== 'new' ? { id: template.id } : {}),
        name,
        criteria: criteria.map((c) => ({ name: c.name, description: c.description ?? null, weight: Number(c.weight), isAiSuggested: false })),
      })
      toast.success(template === 'new' ? 'Template created' : 'Template updated', { duration: 4000 })
      onClose()
    } catch (err) {
      form.setError('root', { message: err instanceof Error ? err.message : 'We could not save the template.' })
    }
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl rounded">
        <DialogHeader>
          <DialogTitle>{template === 'new' ? 'New scoring template' : 'Edit scoring template'}</DialogTitle>
          <DialogDescription>Criteria weights must add up to 100%.</DialogDescription>
        </DialogHeader>
        <form method="post" onSubmit={submit} noValidate className="space-y-5">
          <FormField id="template-name" label="Template name" required error={errors.name?.message}>
            <Input autoComplete="off" {...fieldA11y('template-name', errors.name?.message)} {...form.register('name')} />
          </FormField>
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_8rem_2.25rem] gap-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span>Criterion</span>
              <span>Weight (%)</span>
              <span className="sr-only">Remove</span>
            </div>
            <ol className="space-y-2" aria-label="Template criteria">
              {fields.map((field, i) => (
                <li key={field.id} className="grid grid-cols-[1fr_8rem_2.25rem] items-start gap-3">
                  <div>
                    <Input aria-label={`Criterion ${i + 1} name`} aria-invalid={errors.criteria?.[i]?.name ? true : undefined} {...form.register(`criteria.${i}.name`)} />
                    {errors.criteria?.[i]?.name?.message && <p className="mt-1 text-xs text-destructive">{errors.criteria[i]?.name?.message}</p>}
                  </div>
                  <div>
                    <Input type="number" inputMode="decimal" min={0} max={100} step="0.01" aria-label={`Criterion ${i + 1} weight`} aria-invalid={errors.criteria?.[i]?.weight ? true : undefined} {...form.register(`criteria.${i}.weight`)} />
                    {errors.criteria?.[i]?.weight?.message && <p className="mt-1 text-xs text-destructive">{errors.criteria[i]?.weight?.message}</p>}
                  </div>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove criterion ${i + 1}`} onClick={() => remove(i)}>
                    <X />
                  </Button>
                </li>
              ))}
            </ol>
            <Button type="button" variant="outline" size="sm" onClick={() => append({ name: '', description: null, weight: 0, isAiSuggested: false })}>
              <Plus aria-hidden="true" />
              Add Criterion
            </Button>
          </div>
          <DialogFooter className="items-center gap-3 pt-4">
            <p className={cn('mr-auto text-sm font-medium', totalOk ? 'text-foreground' : 'text-destructive')} aria-live="polite">
              Total: {total}% {totalOk ? '' : '— must equal 100%'}
            </p>
            {(errors.root?.message || errors.criteria?.message) && (
              <p role="alert" className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="size-3" aria-hidden="true" />
                {errors.root?.message ?? errors.criteria?.message}
              </p>
            )}
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <SubmitButton pending={isSubmitting} pendingLabel="Saving template" disabled={!totalOk}>
              Save Template
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
