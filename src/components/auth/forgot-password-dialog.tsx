'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { FormField, fieldA11y } from '@/components/forms/form-field'
import { SubmitButton } from '@/components/forms/submit-button'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { fetchJson } from '@/lib/fetch-json'
import { resetRequestSchema, type ResetRequestFormValues } from '@/lib/schemas/auth'

// App Flow §3 password reset, step 1 (decision P3-4: modal on /login). Always reports
// success, whether or not the email exists.
export function ForgotPasswordDialog() {
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)
  const form = useForm<ResetRequestFormValues>({ resolver: zodResolver(resetRequestSchema), defaultValues: { email: '' } })
  const { errors, isSubmitting } = form.formState

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      setSent(false)
      form.reset()
    }
  }

  const onSubmit = form.handleSubmit(async (values) => {
    await fetchJson('/api/auth/reset-password', { method: 'POST', body: JSON.stringify(values) }).catch(() => undefined)
    setSent(true)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="link" className="h-auto p-0 text-sm">
          Forgot password?
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Reset your password</DialogTitle>
          <DialogDescription>Enter your email and we&apos;ll send you a link to set a new password.</DialogDescription>
        </DialogHeader>
        {sent ? (
          <>
            <p role="status" className="flex items-start gap-2 text-sm text-foreground">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-500" aria-hidden="true" />
              If an account exists for that email, a reset link is on its way. It expires in 60 minutes.
            </p>
            <DialogFooter>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form method="post" onSubmit={onSubmit} noValidate className="space-y-5">
            <FormField id="reset-email" label="Email" required error={errors.email?.message}>
              <Input type="email" autoComplete="email" {...fieldA11y('reset-email', errors.email?.message)} {...form.register('email')} />
            </FormField>
            <DialogFooter className="gap-3 pt-6">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <SubmitButton pending={isSubmitting} pendingLabel="Sending reset link">
                Send Reset Link
              </SubmitButton>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
