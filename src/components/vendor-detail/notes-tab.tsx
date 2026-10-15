'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { format, formatDistanceToNow } from 'date-fns'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { FormField, fieldA11y } from '@/components/forms/form-field'
import { SubmitButton } from '@/components/forms/submit-button'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/fetch-json'
import { useAddNote, useNotes } from '@/lib/queries/evaluation'
import { noteSchema, type NoteRequest } from '@/lib/schemas/evaluation'
import type { VendorNote } from '@/lib/vendor-detail'

type NotesTabProps = { rfpId: string; entryId: string; initialNotes: VendorNote[]; locked: boolean }

// App Flow §4 Tab 4 — Notes: textarea + "Add Note", then notes with author and timestamp.
// Internal only, append-only — no edit or delete (decision P7-5).
export function NotesTab({ rfpId, entryId, initialNotes, locked }: NotesTabProps) {
  const { data: notes } = useNotes(rfpId, entryId, initialNotes)
  const add = useAddNote(rfpId, entryId)
  const form = useForm<NoteRequest>({ resolver: zodResolver(noteSchema), defaultValues: { body: '' } })
  const { errors, isSubmitting } = form.formState

  const submit = form.handleSubmit(async (values) => {
    try {
      await add.mutateAsync(values)
      form.reset({ body: '' })
      toast.success('Note added', { duration: 4000 })
    } catch (err) {
      const fields = err instanceof ApiError ? err.body.fields : undefined
      form.setError('body', { message: fields?.body?.[0] ?? (err instanceof Error ? err.message : 'We could not save the note.') })
    }
  })

  return (
    <div className="max-w-3xl space-y-6">
      {!locked && (
        <form method="post" onSubmit={submit} noValidate className="space-y-3">
          <FormField id="vendor-note" label="Add a note" error={errors.body?.message} hint="Internal only — vendors never see notes. Notes can't be edited or deleted.">
            <Textarea className="min-h-[96px] resize-y rounded" {...fieldA11y('vendor-note', errors.body?.message)} {...form.register('body')} />
          </FormField>
          <div className="flex justify-end">
            <SubmitButton pending={isSubmitting} pendingLabel="Adding note">
              Add Note
            </SubmitButton>
          </div>
        </form>
      )}
      <ol className="space-y-4" aria-label="Notes">
        {notes.map((n) => (
          <li key={n.id} className="rounded border border-border bg-card p-4 shadow-sm">
            <div className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{n.authorName}</span>
              <time dateTime={n.createdAt} title={format(new Date(n.createdAt), 'd MMM yyyy, HH:mm')}>
                {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
              </time>
            </div>
            <p className="whitespace-pre-line text-sm text-foreground">{n.body}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
