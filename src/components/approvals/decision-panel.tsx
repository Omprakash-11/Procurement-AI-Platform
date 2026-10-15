'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { FormField, fieldA11y } from '@/components/forms/form-field'
import { SubmitButton } from '@/components/forms/submit-button'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ApiError, fetchJson } from '@/lib/fetch-json'
import { approveSchema, REJECTION_REASON_LABEL } from '@/lib/schemas/approval'
import { Constants } from '@/types/database'

type Kind = 'approved' | 'rejected'

// App Flow §6 decision section: "Approve" (green) and "Reject" (red), each opening a
// confirmation modal with a mandatory comment; Reject also needs a reason.
export function DecisionPanel({ approvalId, vendorName }: { approvalId: string; vendorName: string }) {
  const [open, setOpen] = useState<Kind | null>(null)
  return (
    <section aria-labelledby="decision" className="space-y-3 rounded border border-border bg-card p-6 shadow-sm">
      <h2 id="decision" className="text-xl font-semibold text-foreground">
        Your decision
      </h2>
      <p className="text-sm text-muted-foreground">Approving creates the contract with {vendorName}. Both choices notify the procurement manager.</p>
      <div className="flex gap-3">
        <Button className="bg-status-success-foreground text-background hover:bg-status-success-foreground/90" onClick={() => setOpen('approved')}>
          <CheckCircle2 aria-hidden="true" />
          Approve
        </Button>
        <Button variant="destructive" onClick={() => setOpen('rejected')}>
          <XCircle aria-hidden="true" />
          Reject
        </Button>
      </div>
      <DecisionDialog kind="approved" approvalId={approvalId} vendorName={vendorName} open={open === 'approved'} onOpenChange={(o) => setOpen(o ? 'approved' : null)} />
      <DecisionDialog kind="rejected" approvalId={approvalId} vendorName={vendorName} open={open === 'rejected'} onOpenChange={(o) => setOpen(o ? 'rejected' : null)} />
    </section>
  )
}

// One form for both modals; the reason is required only when rejecting, validated together
// with the comment so both inline errors show at once.
const baseSchema = approveSchema.pick({ comment: true }).extend({ reason: z.enum(Constants.public.Enums.rejection_reason).optional() })
const rejectFormSchema = baseSchema.refine((v) => Boolean(v.reason), { message: 'Choose a reason.', path: ['reason'] })
type Values = z.infer<typeof baseSchema>

function DecisionDialog({ kind, approvalId, vendorName, open, onOpenChange }: { kind: Kind; approvalId: string; vendorName: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter()
  const form = useForm<Values>({ resolver: zodResolver(kind === 'rejected' ? rejectFormSchema : baseSchema), defaultValues: { comment: '' } })
  const { errors, isSubmitting } = form.formState
  const id = `decision-${kind}`

  const submit = form.handleSubmit(async (values) => {
    const body = kind === 'approved' ? { decision: 'approved', comment: values.comment } : { decision: 'rejected', comment: values.comment, reason: values.reason }
    try {
      await fetchJson(`/api/approvals/${approvalId}/decide`, { method: 'PATCH', body: JSON.stringify(body) })
      onOpenChange(false)
      toast.success(kind === 'approved' ? `${vendorName} approved — contract created` : `${vendorName} rejected`, { duration: 4000 })
      router.refresh()
    } catch (err) {
      const fields = err instanceof ApiError ? err.body.fields : undefined
      if (fields?.comment?.[0]) return form.setError('comment', { message: fields.comment[0] })
      if (fields?.reason?.[0]) return form.setError('reason', { message: fields.reason[0] })
      form.setError('root', { message: err instanceof Error ? err.message : 'We could not record the decision.' })
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded">
        <DialogHeader>
          <DialogTitle>{kind === 'approved' ? `Approve ${vendorName}?` : `Reject ${vendorName}?`}</DialogTitle>
          <DialogDescription>
            {kind === 'approved' ? 'A contract record is created and the vendor is marked Contracted.' : 'The vendor stays shortlisted and the procurement manager sees your reason.'}
          </DialogDescription>
        </DialogHeader>
        <form method="post" onSubmit={submit} noValidate className="space-y-5">
          {kind === 'rejected' && (
            <FormField id={`${id}-reason`} label="Reason" required error={errors.reason?.message}>
              <Controller
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <SelectTrigger id={`${id}-reason`} aria-invalid={errors.reason ? true : undefined}>
                      <SelectValue placeholder="Choose a reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {Constants.public.Enums.rejection_reason.map((r) => (
                        <SelectItem key={r} value={r}>
                          {REJECTION_REASON_LABEL[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          )}
          <FormField id={`${id}-comment`} label="Comment" required error={errors.comment?.message}>
            <Textarea className="min-h-[96px] resize-y rounded" {...fieldA11y(`${id}-comment`, errors.comment?.message)} {...form.register('comment')} />
          </FormField>
          {errors.root?.message && (
            <p role="alert" className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="size-3 shrink-0" aria-hidden="true" />
              {errors.root.message}
            </p>
          )}
          <DialogFooter className="gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <SubmitButton
              pending={isSubmitting}
              pendingLabel="Recording decision"
              variant={kind === 'rejected' ? 'destructive' : 'default'}
              className={kind === 'approved' ? 'bg-status-success-foreground text-background hover:bg-status-success-foreground/90' : undefined}
            >
              {kind === 'approved' ? 'Approve' : 'Reject'}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
