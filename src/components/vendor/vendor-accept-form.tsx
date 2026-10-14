'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { FormField, fieldA11y } from '@/components/forms/form-field'
import { SubmitButton } from '@/components/forms/submit-button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ApiError, fetchJson } from '@/lib/fetch-json'
import {
  vendorAcceptCreateSchema,
  vendorAcceptLoginSchema,
  type VendorAcceptCreateValues,
  type VendorAcceptLoginValues,
} from '@/lib/schemas/vendor-portal'

type VendorAcceptFormProps = {
  token: string
  mode: 'create' | 'login'
  orgName: string
  rfpTitle: string
  email: string
  companyName: string
  personalMessage: string | null
}

// App Flow §7: org name, RFP title, intro message; account creation (full name, company —
// prefilled, password, confirm) or, for an existing vendor login, a sign-in form.
// "Accept Invite & Continue" → /vendor/rfp/[id].
export function VendorAcceptForm(props: VendorAcceptFormProps) {
  return (
    <Card>
      <CardHeader className="space-y-3">
        <h1 className="font-heading text-4xl text-card-foreground">You&apos;re invited</h1>
        <CardDescription>
          <span className="font-medium text-foreground">{props.orgName}</span> has invited you to submit a proposal for{' '}
          <span className="font-medium text-foreground">{props.rfpTitle}</span>.
        </CardDescription>
        {props.personalMessage && (
          <blockquote className="whitespace-pre-line border-l-2 border-border pl-3 text-sm text-muted-foreground">{props.personalMessage}</blockquote>
        )}
      </CardHeader>
      <CardContent>{props.mode === 'create' ? <CreateAccount {...props} /> : <SignIn {...props} />}</CardContent>
    </Card>
  )
}

function useAccept(token: string) {
  const [formError, setFormError] = useState<string | null>(null)
  const accept = async (body: object, onFields: (fields: Record<string, string[] | undefined>) => boolean) => {
    setFormError(null)
    try {
      const { redirectTo } = await fetchJson<{ redirectTo: string }>(`/api/vendor/invite/${token}`, { method: 'POST', body: JSON.stringify(body) })
      window.location.assign(redirectTo) // full load: fresh session + vendor shell
    } catch (err) {
      if (err instanceof ApiError && err.body.code === 'invite_invalid') {
        window.location.assign(`/vendor/invite/expired?invite=${encodeURIComponent(token)}`)
        return
      }
      if (err instanceof ApiError && err.body.fields && onFields(err.body.fields)) return
      setFormError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }
  return { formError, accept }
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="flex items-start gap-2 rounded border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  )
}

function CreateAccount({ token, email, companyName }: VendorAcceptFormProps) {
  const { formError, accept } = useAccept(token)
  const form = useForm<VendorAcceptCreateValues>({
    resolver: zodResolver(vendorAcceptCreateSchema),
    defaultValues: { fullName: '', companyName, password: '', confirmPassword: '' },
  })
  const { errors, isSubmitting } = form.formState
  const submit = form.handleSubmit(({ fullName, companyName: company, password }) =>
    accept({ mode: 'create', fullName, companyName: company, password }, (fields) => {
      if (fields.password?.[0]) {
        form.setError('password', { message: fields.password[0] })
        return true
      }
      return false
    })
  )
  return (
    <form method="post" onSubmit={submit} noValidate className="space-y-5">
      <FormError message={formError} />
      <p className="text-sm text-muted-foreground">
        Create your vendor account for <span className="font-medium text-foreground">{email}</span>.
      </p>
      <FormField id="vendor-fullName" label="Full name" required error={errors.fullName?.message}>
        <Input autoComplete="name" {...fieldA11y('vendor-fullName', errors.fullName?.message)} {...form.register('fullName')} />
      </FormField>
      <FormField id="vendor-company" label="Company name" required error={errors.companyName?.message}>
        <Input autoComplete="organization" defaultValue={companyName} {...fieldA11y('vendor-company', errors.companyName?.message)} {...form.register('companyName')} />
      </FormField>
      <FormField id="vendor-password" label="Password" required error={errors.password?.message} hint="At least 8 characters, with letters and numbers.">
        <Input type="password" autoComplete="new-password" {...fieldA11y('vendor-password', errors.password?.message)} {...form.register('password')} />
      </FormField>
      <FormField id="vendor-confirmPassword" label="Confirm password" required error={errors.confirmPassword?.message}>
        <Input type="password" autoComplete="new-password" {...fieldA11y('vendor-confirmPassword', errors.confirmPassword?.message)} {...form.register('confirmPassword')} />
      </FormField>
      <SubmitButton pending={isSubmitting} pendingLabel="Accepting invite" size="lg" className="w-full">
        Accept Invite &amp; Continue
      </SubmitButton>
    </form>
  )
}

function SignIn({ token, email }: VendorAcceptFormProps) {
  const { formError, accept } = useAccept(token)
  const form = useForm<VendorAcceptLoginValues>({ resolver: zodResolver(vendorAcceptLoginSchema), defaultValues: { password: '' } })
  const { errors, isSubmitting } = form.formState
  const submit = form.handleSubmit(({ password }) =>
    accept({ mode: 'login', password }, (fields) => {
      if (fields.password?.[0]) {
        form.setError('password', { message: fields.password[0] })
        return true
      }
      return false
    })
  )
  return (
    <form method="post" onSubmit={submit} noValidate className="space-y-5">
      <FormError message={formError} />
      <p className="text-sm text-muted-foreground">
        You already have a vendor account for <span className="font-medium text-foreground">{email}</span>. Sign in to accept.
      </p>
      <FormField id="vendor-login-password" label="Password" required error={errors.password?.message}>
        <Input type="password" autoComplete="current-password" {...fieldA11y('vendor-login-password', errors.password?.message)} {...form.register('password')} />
      </FormField>
      <SubmitButton pending={isSubmitting} pendingLabel="Accepting invite" size="lg" className="w-full">
        Accept Invite &amp; Continue
      </SubmitButton>
    </form>
  )
}
