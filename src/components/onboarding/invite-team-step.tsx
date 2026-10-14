'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { FormField, fieldA11y } from '@/components/forms/form-field'
import { SubmitButton } from '@/components/forms/submit-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { fetchJson } from '@/lib/fetch-json'
import { MAX_TEAM_INVITES, inviteTeamSchema, type InviteTeamFormValues } from '@/lib/schemas/auth'

type InviteResult = { email: string; status: 'sent' | 'error'; message?: string }

// App Flow §3.1 step 2: repeatable email + role rows (max 10), "Send Invites + Continue"
// or "Skip for now". Rows that fail stay on screen with their error.
export function InviteTeamStep() {
  const router = useRouter()
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
  const form = useForm<InviteTeamFormValues>({
    resolver: zodResolver(inviteTeamSchema),
    defaultValues: { invites: [{ email: '', role: 'department_head' }] },
  })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'invites' })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setRowErrors({})
    let results: InviteResult[]
    try {
      ;({ results } = await fetchJson<{ results: InviteResult[] }>('/api/auth/invite-team', { method: 'POST', body: JSON.stringify(values) }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'We could not send the invites.', { duration: 6000 })
      return
    }

    const failed = results.filter((r) => r.status === 'error')
    const sentCount = results.length - failed.length
    if (sentCount > 0) toast.success(`${sentCount} invite${sentCount === 1 ? '' : 's'} sent`, { duration: 4000 })

    if (failed.length === 0) {
      router.push('/onboarding?step=3')
      router.refresh()
      return
    }
    // Keep only the rows that failed, with their messages.
    const failedEmails = new Set(failed.map((r) => r.email))
    const remaining = values.invites.filter((row) => failedEmails.has(row.email.toLowerCase()))
    form.reset({ invites: remaining })
    setRowErrors(Object.fromEntries(failed.map((r) => [r.email, r.message ?? 'Could not invite.'])))
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <ul className="space-y-4">
        {fields.map((field, index) => {
          const emailError =
            errors.invites?.[index]?.email?.message ?? rowErrors[form.getValues(`invites.${index}.email`).toLowerCase()]
          return (
            <li key={field.id} className="flex items-start gap-3">
              <div className="flex-1">
                <FormField id={`invite-email-${index}`} label="Email address" error={emailError}>
                  <Input type="email" {...fieldA11y(`invite-email-${index}`, emailError)} {...form.register(`invites.${index}.email`)} />
                </FormField>
              </div>
              <div className="w-48">
                <FormField id={`invite-role-${index}`} label="Role" error={errors.invites?.[index]?.role?.message}>
                  <Controller
                    control={form.control}
                    name={`invites.${index}.role`}
                    render={({ field: roleField }) => (
                      <Select value={roleField.value} onValueChange={roleField.onChange}>
                        <SelectTrigger id={`invite-role-${index}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="department_head">Department Head</SelectItem>
                          <SelectItem value="finance_approver">Finance Approver</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-7"
                aria-label={`Remove invite row ${index + 1}`}
                title="Remove"
                disabled={fields.length === 1}
                onClick={() => remove(index)}
              >
                <X />
              </Button>
            </li>
          )
        })}
      </ul>
      {fields.length < MAX_TEAM_INVITES && (
        <Button type="button" variant="link" className="h-auto p-0" onClick={() => append({ email: '', role: 'department_head' })}>
          <Plus aria-hidden="true" />
          Add another
        </Button>
      )}
      <div className="flex items-center justify-between pt-1">
        <Link href="/onboarding?step=3" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          Skip for now
        </Link>
        <SubmitButton pending={isSubmitting} pendingLabel="Sending invites">
          Send Invites + Continue
        </SubmitButton>
      </div>
    </form>
  )
}
