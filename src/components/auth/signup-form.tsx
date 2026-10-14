'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, MailCheck } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { FormField, fieldA11y } from '@/components/forms/form-field'
import { SubmitButton } from '@/components/forms/submit-button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ApiError, fetchJson } from '@/lib/fetch-json'
import { signupSchema, type SignupFormValues } from '@/lib/schemas/auth'

export function SignupForm() {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: '', email: '', orgName: '' },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null)
    try {
      await fetchJson('/api/auth/signup', { method: 'POST', body: JSON.stringify(values) })
      setSentTo(values.email)
    } catch (err) {
      if (err instanceof ApiError && err.body.fields) {
        for (const [field, messages] of Object.entries(err.body.fields)) {
          if (messages?.[0] && field in values) form.setError(field as keyof SignupFormValues, { message: messages[0] })
        }
      } else {
        setFormError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      }
    }
  })

  // Decision P3-2: confirm the email before the workspace can be used.
  if (sentTo) {
    return (
      <Card>
        <CardHeader className="space-y-1.5">
          <MailCheck className="size-6 text-primary" aria-hidden="true" />
          <h1 className="font-heading text-4xl text-card-foreground">Check your email</h1>
          <CardDescription>
            We sent a confirmation link to <span className="font-medium text-foreground">{sentTo}</span>. Open it to choose your password and
            finish setting up your workspace. The link expires in 60 minutes.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="space-y-1.5">
        <h1 className="font-heading text-4xl text-card-foreground">Create your workspace</h1>
        <CardDescription>
          Set up ProcureMaster for your organisation. You&apos;ll be its Procurement Manager. We&apos;ll email you a link to confirm your address
          and choose a password.
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
            <Input autoComplete="name" {...fieldA11y('fullName', errors.fullName?.message)} {...form.register('fullName')} />
          </FormField>
          <FormField id="email" label="Work email" required error={errors.email?.message}>
            <Input type="email" autoComplete="email" {...fieldA11y('email', errors.email?.message)} {...form.register('email')} />
          </FormField>
          <FormField id="orgName" label="Organisation name" required error={errors.orgName?.message}>
            <Input autoComplete="organization" {...fieldA11y('orgName', errors.orgName?.message)} {...form.register('orgName')} />
          </FormField>
          <SubmitButton pending={isSubmitting} pendingLabel="Creating your workspace" size="lg" className="w-full">
            Create Workspace
          </SubmitButton>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
