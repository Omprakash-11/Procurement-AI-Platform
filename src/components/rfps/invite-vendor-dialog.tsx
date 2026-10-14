'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { FormField, fieldA11y } from '@/components/forms/form-field'
import { SubmitButton } from '@/components/forms/submit-button'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/fetch-json'
import { useInviteVendor } from '@/lib/queries/rfps'
import { vendorInviteSchema, type VendorInviteFormValues } from '@/lib/schemas/vendor-invite'

type InviteVendorDialogProps = { rfpId: string; open: boolean; onOpenChange: (open: boolean) => void; onInvited: () => void }

// App Flow §4 Invite Vendor modal: email, company name, personal message. Duplicate → inline
// error on the email field; success → toast "Invite sent to [email]".
export function InviteVendorDialog({ rfpId, open, onOpenChange, onInvited }: InviteVendorDialogProps) {
  const invite = useInviteVendor(rfpId)
  const form = useForm<VendorInviteFormValues>({
    resolver: zodResolver(vendorInviteSchema),
    defaultValues: { email: '', companyName: '', personalMessage: '' },
  })
  const { errors, isSubmitting } = form.formState

  useEffect(() => {
    if (open) form.reset({ email: '', companyName: '', personalMessage: '' })
  }, [open, form])

  const submit = form.handleSubmit(async (values) => {
    try {
      const { email } = await invite.mutateAsync(values)
      onOpenChange(false)
      toast.success(`Invite sent to ${email}`, { duration: 4000 })
      onInvited()
    } catch (err) {
      const fields = err instanceof ApiError ? err.body.fields : undefined
      if (fields?.email?.[0]) return form.setError('email', { message: fields.email[0] })
      if (fields?.companyName?.[0]) return form.setError('companyName', { message: fields.companyName[0] })
      toast.error(err instanceof Error ? err.message : 'We could not send the invite.', { duration: 6000 })
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded">
        <DialogHeader>
          <DialogTitle>Invite vendor</DialogTitle>
          <DialogDescription>The vendor gets an email link to submit a proposal. It expires in 72 hours.</DialogDescription>
        </DialogHeader>
        <form method="post" onSubmit={submit} noValidate className="space-y-5">
          <FormField id="invite-vendor-email" label="Vendor email" required error={errors.email?.message}>
            <Input type="email" autoComplete="off" {...fieldA11y('invite-vendor-email', errors.email?.message)} {...form.register('email')} />
          </FormField>
          <FormField id="invite-vendor-company" label="Vendor company name" required error={errors.companyName?.message}>
            <Input autoComplete="off" {...fieldA11y('invite-vendor-company', errors.companyName?.message)} {...form.register('companyName')} />
          </FormField>
          <FormField id="invite-vendor-message" label="Personal message" error={errors.personalMessage?.message} hint="Optional. Included in the invite email.">
            <Textarea className="min-h-[100px] resize-y rounded" {...fieldA11y('invite-vendor-message', errors.personalMessage?.message)} {...form.register('personalMessage')} />
          </FormField>
          <DialogFooter className="gap-3 pt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <SubmitButton pending={isSubmitting} pendingLabel="Sending invite">
              Send Invite
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
