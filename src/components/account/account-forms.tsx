'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { FormField, fieldA11y } from '@/components/forms/form-field'
import { SubmitButton } from '@/components/forms/submit-button'
import { UserAvatar } from '@/components/layout/user-avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ApiError, fetchJson } from '@/lib/fetch-json'
import {
  accountProfileSchema,
  changePasswordSchema,
  type AccountProfileFormValues,
  type ChangePasswordFormValues,
} from '@/lib/schemas/auth'
import { LOGO_MAX_BYTES, LOGO_MIME_TYPES } from '@/lib/schemas/organisation'

type ProfileFormProps = { fullName: string; email: string; avatarUrl: string | null }

// App Flow §9.1: full name (editable), email (read-only), profile photo; "Save Profile".
export function AccountProfileForm({ fullName, email, avatarUrl }: ProfileFormProps) {
  const router = useRouter()
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoError, setPhotoError] = useState<string | undefined>(undefined)
  const form = useForm<AccountProfileFormValues>({ resolver: zodResolver(accountProfileSchema), defaultValues: { fullName } })
  const { errors, isSubmitting } = form.formState

  const onPhotoChange = (file: File | undefined) => {
    setPhotoError(undefined)
    setPhoto(null)
    if (!file) return
    if (!(LOGO_MIME_TYPES as readonly string[]).includes(file.type)) return setPhotoError('Photo must be a PNG, JPG or WebP image.')
    if (file.size > LOGO_MAX_BYTES) return setPhotoError('Photo must be 2MB or smaller.')
    setPhoto(file)
  }

  const onSubmit = form.handleSubmit(async (values) => {
    if (photoError) return
    const body = new FormData()
    body.set('fullName', values.fullName)
    if (photo) body.set('photo', photo)
    try {
      await fetchJson('/api/account', { method: 'PATCH', body })
      toast.success('Profile saved', { duration: 4000 })
      router.refresh()
    } catch (err) {
      if (err instanceof ApiError && err.body.fields?.photo?.[0]) return setPhotoError(err.body.fields.photo[0])
      if (err instanceof ApiError && err.body.fields?.fullName?.[0]) return form.setError('fullName', { message: err.body.fields.fullName[0] })
      toast.error(err instanceof Error ? err.message : 'We could not save your profile.', { duration: 6000 })
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>How you appear to others in your organisation.</CardDescription>
      </CardHeader>
      <CardContent>
        <form method="post" onSubmit={onSubmit} noValidate className="max-w-xl space-y-5">
          <FormField id="account-fullName" label="Full name" required error={errors.fullName?.message}>
            <Input autoComplete="name" defaultValue={fullName} {...fieldA11y('account-fullName', errors.fullName?.message)} {...form.register('fullName')} />
          </FormField>
          <FormField id="account-email" label="Email" hint="Contact your administrator to change your email.">
            <Input id="account-email" type="email" value={email} readOnly disabled aria-describedby="account-email-hint" />
          </FormField>
          <FormField id="account-photo" label="Profile photo" error={photoError} hint="Optional. PNG, JPG or WebP, up to 2MB.">
            <div className="flex items-center gap-3">
              <UserAvatar name={fullName} src={avatarUrl} className="size-10" />
              <Input type="file" accept={LOGO_MIME_TYPES.join(',')} {...fieldA11y('account-photo', photoError)} onChange={(e) => onPhotoChange(e.target.files?.[0])} />
            </div>
          </FormField>
          <SubmitButton pending={isSubmitting} pendingLabel="Saving profile">
            Save Profile
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  )
}

// App Flow §9.1 change password section — separate "Update Password" button.
export function ChangePasswordForm() {
  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', password: '', confirmPassword: '' },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async ({ currentPassword, password }) => {
    try {
      await fetchJson('/api/account/password', { method: 'POST', body: JSON.stringify({ currentPassword, password }) })
      form.reset()
      toast.success('Password updated', { duration: 4000 })
    } catch (err) {
      const fields = err instanceof ApiError ? err.body.fields : undefined
      if (fields?.currentPassword?.[0]) return form.setError('currentPassword', { message: fields.currentPassword[0] })
      if (fields?.password?.[0]) return form.setError('password', { message: fields.password[0] })
      toast.error(err instanceof Error ? err.message : 'We could not update your password.', { duration: 6000 })
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>At least 8 characters, with letters and numbers.</CardDescription>
      </CardHeader>
      <CardContent>
        <form method="post" onSubmit={onSubmit} noValidate className="max-w-xl space-y-5">
          <FormField id="currentPassword" label="Current password" required error={errors.currentPassword?.message}>
            <Input type="password" autoComplete="current-password" {...fieldA11y('currentPassword', errors.currentPassword?.message)} {...form.register('currentPassword')} />
          </FormField>
          <FormField id="newPassword" label="New password" required error={errors.password?.message}>
            <Input type="password" autoComplete="new-password" {...fieldA11y('newPassword', errors.password?.message)} {...form.register('password')} />
          </FormField>
          <FormField id="confirmNewPassword" label="Confirm new password" required error={errors.confirmPassword?.message}>
            <Input type="password" autoComplete="new-password" {...fieldA11y('confirmNewPassword', errors.confirmPassword?.message)} {...form.register('confirmPassword')} />
          </FormField>
          <SubmitButton pending={isSubmitting} pendingLabel="Updating password" variant="outline">
            Update Password
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  )
}
