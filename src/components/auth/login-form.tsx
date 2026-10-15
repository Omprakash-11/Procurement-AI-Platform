'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { ForgotPasswordDialog } from '@/components/auth/forgot-password-dialog'
import { FormField, fieldA11y } from '@/components/forms/form-field'
import { SubmitButton } from '@/components/forms/submit-button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { getAppClaims, homePathFor } from '@/lib/auth/claims'
import type { DemoLogin } from '@/lib/demo'
import { loginSchema, type LoginFormValues } from '@/lib/schemas/auth'
import { createClient } from '@/lib/supabase/client'

const DISABLED_MESSAGE = 'Your account has been disabled. Contact your administrator.'

type LoginFormProps = {
  redirectTo: string
  reason: string | null
  /** Decision P12-2: demo deployments list their shared logins. */
  demo?: { password: string; logins: DemoLogin[] } | null
}

export function LoginForm({ redirectTo, reason, demo }: LoginFormProps) {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(reason === 'disabled' ? DISABLED_MESSAGE : null)
  const announced = useRef(false)

  const form = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })
  const { errors, isSubmitting } = form.formState

  // App Flow §10.2 / §3 toasts carried over from redirects.
  useEffect(() => {
    if (announced.current) return
    announced.current = true
    // Child effects run before the root <Toaster> subscribes; defer one tick so toasts aren't lost.
    setTimeout(() => {
      if (reason === 'expired') toast.error('Your session has expired. Please sign in again.', { duration: 6000 })
      if (reason === 'password_updated') toast.success('Password updated — please sign in', { duration: 4000 })
    }, 0)
    if (reason === 'link_expired') setFormError('That link has expired or was already used. Request a new one.')
  }, [reason])

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword(values)

    if (error) {
      if (error.code === 'email_not_confirmed') {
        setFormError('Confirm your email address first — check your inbox for the link.')
      } else {
        form.setError('password', { message: 'Invalid email or password' })
      }
      return
    }

    const home = homePathFor(getAppClaims(data.session?.access_token))
    if (!home) {
      await supabase.auth.signOut()
      setFormError(DISABLED_MESSAGE)
      return
    }
    router.replace(redirectTo || home)
    router.refresh()
  })

  return (
    <Card>
      <CardHeader className="space-y-1.5">
        <h1 className="font-heading text-4xl text-card-foreground">Sign in</h1>
        <CardDescription>Use your work email and password.</CardDescription>
      </CardHeader>
      <CardContent>
        <form method="post" onSubmit={onSubmit} noValidate className="space-y-5">
          {formError && (
            <p role="alert" className="flex items-start gap-2 rounded border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {formError}
            </p>
          )}
          <FormField id="email" label="Email" error={errors.email?.message}>
            <Input type="email" autoComplete="email" {...fieldA11y('email', errors.email?.message)} {...form.register('email')} />
          </FormField>
          <FormField id="password" label="Password" error={errors.password?.message}>
            <Input type="password" autoComplete="current-password" {...fieldA11y('password', errors.password?.message)} {...form.register('password')} />
          </FormField>
          <div className="flex justify-end">
            <ForgotPasswordDialog />
          </div>
          <SubmitButton pending={isSubmitting} pendingLabel="Signing in" size="lg" className="w-full">
            Sign In
          </SubmitButton>
        </form>
        {demo && (
          <section aria-labelledby="demo-accounts" className="mt-8 border-t border-border pt-6" data-testid="demo-accounts">
            <h2 id="demo-accounts" className="text-sm font-medium text-foreground">
              Demo accounts
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">This is a demonstration environment. Choose a role to fill in its sign-in details, then select Sign In.</p>
            <ul className="mt-3 space-y-1.5">
              {demo.logins.map((login) => (
                <li key={login.email}>
                  <button
                    type="button"
                    onClick={() => {
                      form.setValue('email', login.email, { shouldValidate: false })
                      form.setValue('password', demo.password, { shouldValidate: false })
                      setFormError(null)
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded border border-border px-3 py-2 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="font-medium text-foreground">{login.label}</span>
                    <span className="truncate text-xs text-muted-foreground">{login.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  )
}
