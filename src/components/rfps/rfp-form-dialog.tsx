'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useForm } from 'react-hook-form'

import { FormField, fieldA11y } from '@/components/forms/form-field'
import { SubmitButton } from '@/components/forms/submit-button'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/fetch-json'
import { deadlineToIso, rfpSchema, type RFPFormInput, type RFPFormValues, type RFPRequest } from '@/lib/schemas/rfp'

export type RfpFormDefaults = {
  title?: string
  description?: string
  department?: string
  budgetMin?: number | null
  budgetMax?: number | null
  submissionDeadline?: string // yyyy-mm-dd
  requirementId?: string
}

type RfpFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  defaults?: RfpFormDefaults
  /** Departments already used in the org (decision P5-3 suggestions). */
  departments: string[]
  currency: string
  onSubmit: (body: RFPRequest) => Promise<void>
}

const blank = (d?: RfpFormDefaults): RFPFormInput => ({
  title: d?.title ?? '',
  description: d?.description ?? '',
  department: d?.department ?? '',
  budgetMin: d?.budgetMin == null ? '' : String(d.budgetMin),
  budgetMax: d?.budgetMax == null ? '' : String(d.budgetMax),
  submissionDeadline: d?.submissionDeadline ?? '',
  ...(d?.requirementId ? { requirementId: d.requirementId } : {}),
})

// App Flow §4 Create RFP modal (also "Edit RFP", pre-filled). Content Guidelines §6.6 dialog.
export function RfpFormDialog({ open, onOpenChange, mode, defaults, departments, currency, onSubmit }: RfpFormDialogProps) {
  const listId = useId()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<RFPFormInput, unknown, RFPFormValues>({ resolver: zodResolver(rfpSchema), defaultValues: blank(defaults) })
  const { errors, isSubmitting } = form.formState

  useEffect(() => {
    if (open) {
      form.reset(blank(defaults))
      setFormError(null)
    }
  }, [open, defaults, form])

  const submit = form.handleSubmit(async (v) => {
    setFormError(null)
    try {
      await onSubmit({
        title: v.title,
        description: v.description,
        department: v.department,
        budgetMin: v.budgetMin,
        budgetMax: v.budgetMax,
        submissionDeadline: deadlineToIso(v.submissionDeadline),
        ...(v.requirementId ? { requirementId: v.requirementId } : {}),
      })
    } catch (err) {
      const fields = err instanceof ApiError ? err.body.fields : undefined
      let mapped = false
      for (const [field, messages] of Object.entries(fields ?? {})) {
        if (messages?.[0] && field in v) {
          form.setError(field as keyof RFPFormInput, { message: messages[0] })
          mapped = true
        }
      }
      if (!mapped) setFormError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Create RFP' : 'Edit RFP'}</DialogTitle>
          <DialogDescription>
            {mode === 'create' ? 'Set up a new procurement event. You can invite vendors once it exists.' : 'Update the RFP details.'}
          </DialogDescription>
        </DialogHeader>
        <form method="post" onSubmit={submit} noValidate className="space-y-5">
          {formError && (
            <p role="alert" className="flex items-start gap-2 rounded border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {formError}
            </p>
          )}
          <FormField id="rfp-title" label="RFP Title" required error={errors.title?.message}>
            <Input {...fieldA11y('rfp-title', errors.title?.message)} {...form.register('title')} />
          </FormField>
          <FormField id="rfp-description" label="Description" required error={errors.description?.message}>
            <Textarea className="min-h-[100px] resize-y rounded" {...fieldA11y('rfp-description', errors.description?.message)} {...form.register('description')} />
          </FormField>
          <FormField id="rfp-department" label="Department" required error={errors.department?.message} hint="Pick an existing department or type a new one.">
            <Input list={listId} autoComplete="off" {...fieldA11y('rfp-department', errors.department?.message)} {...form.register('department')} />
            <datalist id={listId}>
              {departments.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField id="rfp-budget-min" label={`Budget Min (${currency})`} error={errors.budgetMin?.message}>
              <Input type="number" inputMode="decimal" min={0} step="any" {...fieldA11y('rfp-budget-min', errors.budgetMin?.message)} {...form.register('budgetMin')} />
            </FormField>
            <FormField id="rfp-budget-max" label={`Budget Max (${currency})`} error={errors.budgetMax?.message}>
              <Input type="number" inputMode="decimal" min={0} step="any" {...fieldA11y('rfp-budget-max', errors.budgetMax?.message)} {...form.register('budgetMax')} />
            </FormField>
          </div>
          <FormField id="rfp-deadline" label="Submission Deadline" error={errors.submissionDeadline?.message}>
            <Input type="date" {...fieldA11y('rfp-deadline', errors.submissionDeadline?.message)} {...form.register('submissionDeadline')} />
          </FormField>
          <DialogFooter className="gap-3 pt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <SubmitButton pending={isSubmitting} pendingLabel={mode === 'create' ? 'Creating RFP' : 'Saving RFP'}>
              {mode === 'create' ? 'Create RFP' : 'Save Changes'}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
