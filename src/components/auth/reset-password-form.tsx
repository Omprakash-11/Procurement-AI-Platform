'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { FormField, fieldA11y } from '@/components/forms/form-field'
import { SubmitButton } from '@/components/forms/submit-button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ApiError, fetchJson } from '@/lib/fetch-json'
import { resetPasswordSchema, type ResetPasswordFormValues } from '@/lib/schemas/auth'

export function ResetPasswordForm({ tokenHash }: { tokenHash: string }) {
  const router = useRouter()
  const [expired, setExpired] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async ({ password }) => {
    setFormError(null)
    try {
      await fetchJson('/api/auth/reset-password/confirm', { method: 'POST', body: JSON.stringify({ tokenHash, password }) })
      router.replace('/login?reason=password_updated')
    } catch (err) {
      if (err instanceof ApiError && err.body.code === 'link_expired') return setExpired(true)
      if (err instanceof ApiError && err.body.fields?.password?.[0]) return form.setError('password', { message: err.body.fields.password[0] })
      setFormError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  })

  // App Flow §3: expired token → 'This link has expired. Request a new one.' + link to /login
  if (expired) {
    return (
      <Card>
        <CardHeader className="space-y-1.5">
          <h1 className="font-heading text-4xl text-card-foreground">Link expired</h1>
          <CardDescription>This link has expired. Request a new one.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login" className="text-sm font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="space-y-1.5">
        <h1 className="font-heading text-4xl text-card-foreground">Set a new password</h1>
        <CardDescription>Choose a password you haven&apos;t used here before.</CardDescription>
      </CardHeader>
      <CardContent>
        <form method="post" onSubmit={onSubmit} noValidate className="space-y-5">
          {formError && (
            <p role="alert" className="flex items-start gap-2 rounded border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {formError}
            </p>
          )}
          <FormField id="password" label="New Password" required error={errors.password?.message} hint="At least 8 characters, with letters and numbers.">
            <Input type="password" autoComplete="new-password" {...fieldA11y('password', errors.password?.message)} {...form.register('password')} />
          </FormField>
          <FormField id="confirmPassword" label="Confirm Password" required error={errors.confirmPassword?.message}>
            <Input type="password" autoComplete="new-password" {...fieldA11y('confirmPassword', errors.confirmPassword?.message)} {...form.register('confirmPassword')} />
          </FormField>
          <SubmitButton pending={isSubmitting} pendingLabel="Setting password" size="lg" className="w-full">
            Set Password
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  )
}
