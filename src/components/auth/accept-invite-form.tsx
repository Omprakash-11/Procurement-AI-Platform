'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { FormField, fieldA11y } from '@/components/forms/form-field'
import { SubmitButton } from '@/components/forms/submit-button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ApiError, fetchJson } from '@/lib/fetch-json'
import { acceptInviteSchema, type AcceptInviteFormValues } from '@/lib/schemas/auth'

type AcceptInviteFormProps = { token: string; email: string; orgName: string; roleLabel: string; defaultFullName: string }

export function AcceptInviteForm({ token, email, orgName, roleLabel, defaultFullName }: AcceptInviteFormProps) {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<AcceptInviteFormValues>({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: { fullName: defaultFullName, password: '', confirmPassword: '' },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async ({ fullName, password }) => {
    setFormError(null)
    try {
      const { redirectTo } = await fetchJson<{ redirectTo: string }>('/api/auth/accept-invite', {
        method: 'POST',
        body: JSON.stringify({ token, fullName, password }),
      })
      router.replace(redirectTo)
      router.refresh()
    } catch (err) {
      if (err instanceof ApiError && err.body.fields?.password?.[0]) return form.setError('password', { message: err.body.fields.password[0] })
      setFormError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  })

  return (
    <Card>
      <CardHeader className="space-y-1.5">
        <h1 className="font-heading text-4xl text-card-foreground">Join {orgName}</h1>
        <CardDescription>
          You&apos;ve been invited as a {roleLabel}. Set up your account for <span className="font-medium text-foreground">{email}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form method="post" onSubmit={onSubmit} noValidate className="space-y-5">
          {formError && (
            <p role="alert" className="flex items-start gap-2 rounded border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {formError}
            </p>
          )}
          <FormField id="fullName" label="Full name" required error={errors.fullName?.message}>
            <Input autoComplete="name" defaultValue={defaultFullName} {...fieldA11y('fullName', errors.fullName?.message)} {...form.register('fullName')} />
          </FormField>
          <FormField id="password" label="Password" required error={errors.password?.message} hint="At least 8 characters, with letters and numbers.">
            <Input type="password" autoComplete="new-password" {...fieldA11y('password', errors.password?.message)} {...form.register('password')} />
          </FormField>
          <FormField id="confirmPassword" label="Confirm password" required error={errors.confirmPassword?.message}>
            <Input type="password" autoComplete="new-password" {...fieldA11y('confirmPassword', errors.confirmPassword?.message)} {...form.register('confirmPassword')} />
          </FormField>
          <SubmitButton pending={isSubmitting} pendingLabel="Setting up your account" size="lg" className="w-full">
            Accept Invite
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  )
}
