'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'

import { FormField, fieldA11y } from '@/components/forms/form-field'
import { SubmitButton } from '@/components/forms/submit-button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ApiError, fetchJson } from '@/lib/fetch-json'
import {
  CURRENCIES,
  LOGO_MAX_BYTES,
  LOGO_MIME_TYPES,
  orgProfileSchema,
  type OrgProfileFormValues,
} from '@/lib/schemas/organisation'

type OrgProfileStepProps = { defaultName: string; defaultCurrency: OrgProfileFormValues['currency'] }

// App Flow §3.1 step 1: name (required), logo (optional image), default currency (USD).
export function OrgProfileStep({ defaultName, defaultCurrency }: OrgProfileStepProps) {
  const router = useRouter()
  const [logo, setLogo] = useState<File | null>(null)
  const [logoError, setLogoError] = useState<string | undefined>(undefined)
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<OrgProfileFormValues>({
    resolver: zodResolver(orgProfileSchema),
    defaultValues: { name: defaultName, currency: defaultCurrency },
  })
  const { errors, isSubmitting } = form.formState

  const onLogoChange = (file: File | undefined) => {
    setLogoError(undefined)
    setLogo(null)
    if (!file) return
    if (!(LOGO_MIME_TYPES as readonly string[]).includes(file.type)) return setLogoError('Logo must be a PNG, JPG or WebP image.')
    if (file.size > LOGO_MAX_BYTES) return setLogoError('Logo must be 2MB or smaller.')
    setLogo(file)
  }

  const onSubmit = form.handleSubmit(async (values) => {
    if (logoError) return
    setFormError(null)
    const body = new FormData()
    body.set('name', values.name)
    body.set('currency', values.currency)
    if (logo) body.set('logo', logo)
    try {
      await fetchJson('/api/organisation', { method: 'PATCH', body })
      router.push('/onboarding?step=2')
      router.refresh()
    } catch (err) {
      if (err instanceof ApiError && err.body.fields?.logo?.[0]) return setLogoError(err.body.fields.logo[0])
      if (err instanceof ApiError && err.body.fields?.name?.[0]) return form.setError('name', { message: err.body.fields.name[0] })
      setFormError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError && (
        <p role="alert" className="flex items-start gap-2 rounded border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {formError}
        </p>
      )}
      <FormField id="org-name" label="Organisation name" required error={errors.name?.message}>
        {/* defaultValue renders the prefill server-side, so typing before hydration can't mix with it */}
        <Input autoComplete="organization" defaultValue={defaultName} {...fieldA11y('org-name', errors.name?.message)} {...form.register('name')} />
      </FormField>
      <FormField id="org-logo" label="Logo" error={logoError} hint="Optional. PNG, JPG or WebP, up to 2MB.">
        <Input
          type="file"
          accept={LOGO_MIME_TYPES.join(',')}
          {...fieldA11y('org-logo', logoError)}
          onChange={(e) => onLogoChange(e.target.files?.[0])}
        />
      </FormField>
      <FormField id="org-currency" label="Default currency" error={errors.currency?.message}>
        <Controller
          control={form.control}
          name="currency"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="org-currency" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </FormField>
      <div className="flex items-center justify-between pt-1">
        <Link href="/onboarding?step=3" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          Set up later
        </Link>
        <SubmitButton pending={isSubmitting} pendingLabel="Saving organisation">
          Next
        </SubmitButton>
      </div>
    </form>
  )
}
