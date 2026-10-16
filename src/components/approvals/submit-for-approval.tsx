'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Clock, Send, Undo2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { formatUtc } from '@/components/dates/local-date'
import { FormField } from '@/components/forms/form-field'
import { SubmitButton } from '@/components/forms/submit-button'
import { ConfirmDialog } from '@/components/rfps/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ApiError, fetchJson } from '@/lib/fetch-json'
import { approvalRequestSchema, type ApprovalRequestBody } from '@/lib/schemas/approval'

export type ApprovalOption = { id: string; name: string }
export type PendingApproval = { id: string; approverName: string; slaDueAt: string }

type SubmitForApprovalProps = {
  rfpId: string
  shortlisted: ApprovalOption[]
  approvers: ApprovalOption[]
  /** AI-recommended vendor — pre-selected only if it is shortlisted (advisory, P8-1). */
  recommendedVendorId: string | null
  pending: PendingApproval | null
  /** Report generated and the RFP not yet past evaluation. */
  eligible: boolean
  fullWidth?: boolean
}


// App Flow §4 "Submit for Approval" (after the report, once a shortlist is set) → confirmation
// modal. Decision P8-1: the PM picks the shortlisted vendor and the Finance Approver. While a
// request is pending: who has it, the SLA deadline (UTC, P8-2) and Recall (Schema §8.6).
export function SubmitForApproval({ rfpId, shortlisted, approvers, recommendedVendorId, pending, eligible, fullWidth }: SubmitForApprovalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [recallOpen, setRecallOpen] = useState(false)
  const defaultVendor = shortlisted.find((v) => v.id === recommendedVendorId)?.id ?? (shortlisted.length === 1 ? shortlisted[0]!.id : '')
  const form = useForm<ApprovalRequestBody>({
    resolver: zodResolver(approvalRequestSchema),
    defaultValues: { rfpId, vendorAccountId: defaultVendor, financeApproverId: approvers.length === 1 ? approvers[0]!.id : '' },
  })
  const { errors, isSubmitting } = form.formState

  if (pending) {
    return (
      <div className="space-y-2 rounded border border-border p-3" data-testid="approval-pending">
        <p className="flex items-center gap-2 text-sm text-foreground">
          <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
          Approval pending with {pending.approverName}
        </p>
        <p className="text-xs text-muted-foreground">Decision due {formatUtc(pending.slaDueAt, 'EEE, d MMM, HH:mm')} UTC</p>
        <Button variant="outline" size="sm" onClick={() => setRecallOpen(true)}>
          <Undo2 aria-hidden="true" />
          Recall
        </Button>
        <ConfirmDialog
          open={recallOpen}
          onOpenChange={setRecallOpen}
          title="Recall this approval request?"
          description="The finance approver can no longer decide on it, and the RFP returns to Shortlisted so you can resubmit."
          confirmLabel="Recall Request"
          onConfirm={async () => {
            try {
              await fetchJson(`/api/approvals/${pending.id}/recall`, { method: 'PATCH' })
              toast.success('Approval request recalled', { duration: 4000 })
              router.refresh()
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'We could not recall the request.', { duration: 6000 })
            }
          }}
        />
      </div>
    )
  }
  if (!eligible || shortlisted.length === 0) return null

  const submit = form.handleSubmit(async (values) => {
    try {
      await fetchJson('/api/approvals', { method: 'POST', body: JSON.stringify(values) })
      setOpen(false)
      toast.success('Submitted for approval', { duration: 4000 })
      router.refresh()
    } catch (err) {
      const fields = err instanceof ApiError ? err.body.fields : undefined
      if (fields?.vendorAccountId?.[0]) return form.setError('vendorAccountId', { message: fields.vendorAccountId[0] })
      if (fields?.financeApproverId?.[0]) return form.setError('financeApproverId', { message: fields.financeApproverId[0] })
      form.setError('root', { message: err instanceof Error ? err.message : 'We could not submit for approval.' })
    }
  })

  return (
    <>
      <Button className={fullWidth ? 'w-full' : undefined} onClick={() => setOpen(true)}>
        <Send aria-hidden="true" />
        Submit for Approval
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg rounded">
          <DialogHeader>
            <DialogTitle>Submit for approval</DialogTitle>
            <DialogDescription>The finance approver gets an email and has 3 business days to decide. The RFP is locked while the request is pending.</DialogDescription>
          </DialogHeader>
          <form method="post" onSubmit={submit} noValidate className="space-y-5">
            <FormField id="approval-vendor" label="Selected vendor" required error={errors.vendorAccountId?.message} hint="Shortlisted vendors only.">
              <Controller
                control={form.control}
                name="vendorAccountId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="approval-vendor" aria-invalid={errors.vendorAccountId ? true : undefined}>
                      <SelectValue placeholder="Choose a vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {shortlisted.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                          {v.id === recommendedVendorId ? ' (AI recommended)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField id="approval-approver" label="Finance approver" required error={errors.financeApproverId?.message}>
              <Controller
                control={form.control}
                name="financeApproverId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={approvers.length === 0}>
                    <SelectTrigger id="approval-approver" aria-invalid={errors.financeApproverId ? true : undefined}>
                      <SelectValue placeholder={approvers.length ? 'Choose an approver' : 'No finance approver in your team'} />
                    </SelectTrigger>
                    <SelectContent>
                      {approvers.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            {errors.root?.message && (
              <p role="alert" className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="size-3 shrink-0" aria-hidden="true" />
                {errors.root.message}
              </p>
            )}
            <DialogFooter className="gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton pending={isSubmitting} pendingLabel="Submitting for approval">
                Submit for Approval
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
