'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, FileText, Paperclip, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { FormField, fieldA11y } from '@/components/forms/form-field'
import { SubmitButton } from '@/components/forms/submit-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ApiError, fetchJson } from '@/lib/fetch-json'
import { PRIORITY_LABEL } from '@/lib/requirements'
import { ATTACHMENT_SIZE_ERROR, MAX_ATTACHMENT_BYTES, requirementSchema, type RequirementFormInput, type RequirementFormValues } from '@/lib/schemas/requirement'
import { ACCEPTED_EXTENSIONS, ACCEPTED_TYPES } from '@/lib/schemas/vendor-portal'
import { useHydrated } from '@/lib/use-hydrated'
import { mimeForExtension } from '@/lib/vendor/mime'
import { Constants } from '@/types/database'

export type ExistingAttachment = { id: string; fileName: string; sizeBytes: number }

type RequirementFormProps = {
  mode: 'create' | 'edit'
  requirementId?: string
  /** Only drafts can be saved as drafts; a submitted requirement stays submitted. */
  isDraft: boolean
  defaults: RequirementFormInput
  attachments?: ExistingAttachment[]
}

const TYPE_ERROR = 'Only PDF, DOCX, and XLSX files are supported.'
const formatSize = (bytes: number) => (bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)

// App Flow §5 Submit Requirement: fields, attachments (PDF / DOCX / XLSX ≤ 20MB, P8-4),
// "Submit Requirement" | "Save as Draft" | "Cancel". On submit → /requirements with toast
// "Requirement submitted". Files go browser → Storage via signed URLs after the record exists.
export function RequirementForm({ mode, requirementId, isDraft, defaults, attachments = [] }: RequirementFormProps) {
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)
  const hydrated = useHydrated()
  const [files, setFiles] = useState<File[]>([])
  const [existing, setExisting] = useState(attachments)
  const [fileError, setFileError] = useState<string | null>(null)
  const [pending, setPending] = useState<'submit' | 'draft' | null>(null)
  const form = useForm<RequirementFormInput, unknown, RequirementFormValues>({ resolver: zodResolver(requirementSchema), defaultValues: defaults })
  const { errors } = form.formState

  const addFiles = (list: FileList | null) => {
    // Copy now: the FileList is live and is emptied when the input is reset below, before the
    // state updater runs.
    const picked = Array.from(list ?? [])
    if (fileInput.current) fileInput.current.value = ''
    setFileError(null)
    for (const file of picked) {
      const ok = ACCEPTED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext)) && (file.type === '' || file.type in ACCEPTED_TYPES)
      if (!ok) return setFileError(TYPE_ERROR)
      if (file.size > MAX_ATTACHMENT_BYTES) return setFileError(ATTACHMENT_SIZE_ERROR)
    }
    setFiles((prev) => [...prev, ...picked])
  }

  const removeExisting = async (att: ExistingAttachment) => {
    try {
      await fetchJson(`/api/requirements/${requirementId}/attachments/${att.id}`, { method: 'DELETE' })
      setExisting((prev) => prev.filter((a) => a.id !== att.id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'We could not remove the file.', { duration: 6000 })
    }
  }

  const upload = async (id: string, file: File) => {
    const mimeType = mimeForExtension(file.name)
    const { path, signedUrl } = await fetchJson<{ path: string; signedUrl: string }>(`/api/requirements/${id}/attachments`, {
      method: 'POST',
      body: JSON.stringify({ action: 'sign', fileName: file.name, fileSize: file.size, mimeType }),
    })
    const put = await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': mimeType }, body: file })
    if (!put.ok) throw new Error(`Upload of ${file.name} failed. Please retry.`)
    await fetchJson(`/api/requirements/${id}/attachments`, { method: 'POST', body: JSON.stringify({ action: 'confirm', fileName: file.name, path }) })
  }

  const save = (submit: boolean) =>
    form.handleSubmit(async (v) => {
      setPending(submit ? 'submit' : 'draft')
      const body = {
        title: v.title,
        description: v.description,
        department: v.department,
        budgetEstimate: v.budgetEstimate,
        requiredBy: v.requiredBy || null,
        priority: v.priority,
        // Attachments are uploaded before submitting, so the PM is notified with them in place.
        submit: false,
      }
      let id = requirementId
      try {
        if (mode === 'create') {
          id = (await fetchJson<{ requirement: { id: string } }>('/api/requirements', { method: 'POST', body: JSON.stringify(body) })).requirement.id
        } else {
          await fetchJson(`/api/requirements/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
        }
        for (const file of files) await upload(id!, file)
        if (submit) await fetchJson(`/api/requirements/${id}`, { method: 'PATCH', body: JSON.stringify({ ...body, submit: true }) })
        toast.success(submit ? 'Requirement submitted' : mode === 'create' ? 'Requirement saved as draft' : 'Requirement saved', { duration: 4000 })
        router.push(submit || mode === 'create' ? '/requirements' : `/requirements/${id}`)
        router.refresh()
      } catch (err) {
        // The draft already exists: continue on its edit page rather than creating a duplicate.
        if (mode === 'create' && id) {
          toast.error(`Your requirement was saved as a draft, but: ${err instanceof Error ? err.message : 'a file could not be uploaded.'}`, { duration: 8000 })
          router.push(`/requirements/${id}/edit`)
          return
        }
        const fields = err instanceof ApiError ? err.body.fields : undefined
        let placed = false
        for (const key of ['title', 'description', 'department', 'budgetEstimate', 'requiredBy', 'priority'] as const) {
          if (fields?.[key]?.[0]) {
            form.setError(key, { message: fields[key]![0] })
            placed = true
          }
        }
        if (fields?.file?.[0]) setFileError(fields.file[0])
        else if (!placed) form.setError('root', { message: err instanceof Error ? err.message : 'We could not save the requirement.' })
        setPending(null)
      }
    })

  return (
    <form method="post" noValidate onSubmit={save(true)} className="max-w-2xl space-y-5">
      <FormField id="req-title" label="Title" required error={errors.title?.message}>
        <Input autoComplete="off" defaultValue={defaults.title} {...fieldA11y('req-title', errors.title?.message)} {...form.register('title')} />
      </FormField>
      <FormField id="req-description" label="Description" required error={errors.description?.message}>
        <Textarea className="min-h-[140px] resize-y rounded" defaultValue={defaults.description} {...fieldA11y('req-description', errors.description?.message)} {...form.register('description')} />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField id="req-department" label="Department" required error={errors.department?.message}>
          <Input autoComplete="off" defaultValue={defaults.department} {...fieldA11y('req-department', errors.department?.message)} {...form.register('department')} />
        </FormField>
        <FormField id="req-priority" label="Priority" required error={errors.priority?.message}>
          <Controller
            control={form.control}
            name="priority"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="req-priority" aria-invalid={errors.priority ? true : undefined}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Constants.public.Enums.requirement_priority.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
        <FormField id="req-budget" label="Estimated budget" error={errors.budgetEstimate?.message} hint="Optional.">
          <Input type="number" min={0} step="any" inputMode="decimal" defaultValue={defaults.budgetEstimate ?? ''} {...fieldA11y('req-budget', errors.budgetEstimate?.message)} {...form.register('budgetEstimate')} />
        </FormField>
        <FormField id="req-required-by" label="Required delivery date" error={errors.requiredBy?.message}>
          <Input type="date" defaultValue={defaults.requiredBy} {...fieldA11y('req-required-by', errors.requiredBy?.message)} {...form.register('requiredBy')} />
        </FormField>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium text-foreground">Attachments</p>
        <ul className="mb-2 space-y-1.5" aria-label="Attachments">
          {existing.map((a) => (
            <li key={a.id} className="flex items-center gap-2 text-sm">
              <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-foreground">{a.fileName}</span>
              <span className="text-xs text-muted-foreground">{formatSize(a.sizeBytes)}</span>
              <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={`Remove ${a.fileName}`} onClick={() => removeExisting(a)}>
                <X />
              </Button>
            </li>
          ))}
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 text-sm">
              <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-foreground">{f.name}</span>
              <span className="text-xs text-muted-foreground">{formatSize(f.size)} · uploads on save</span>
              <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={`Remove ${f.name}`} onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}>
                <X />
              </Button>
            </li>
          ))}
        </ul>
        <input ref={fileInput} type="file" multiple accept={ACCEPTED_EXTENSIONS.join(',')} className="sr-only" aria-label="Add attachments" disabled={!hydrated} onChange={(e) => addFiles(e.target.files)} />
        <Button type="button" variant="outline" size="sm" disabled={!hydrated} onClick={() => fileInput.current?.click()}>
          <Paperclip aria-hidden="true" />
          Add files
        </Button>
        <p className="mt-1.5 text-xs text-muted-foreground">Reference documents or specs: PDF, DOCX or XLSX, up to 20MB each.</p>
        {fileError && (
          <p id="req-file-error" role="alert" className="mt-1.5 flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="size-3 shrink-0" aria-hidden="true" />
            {fileError}
          </p>
        )}
      </div>

      {errors.root?.message && (
        <p role="alert" className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="size-3 shrink-0" aria-hidden="true" />
          {errors.root.message}
        </p>
      )}
      <div className="flex items-center gap-3 pt-2">
        <SubmitButton pending={pending === 'submit'} pendingLabel="Saving requirement" disabled={pending !== null}>
          {isDraft ? 'Submit Requirement' : 'Save Changes'}
        </SubmitButton>
        {isDraft && (
          <Button type="button" variant="outline" disabled={pending !== null} aria-busy={pending === 'draft' || undefined} onClick={save(false)}>
            {pending === 'draft' ? 'Saving…' : 'Save as Draft'}
          </Button>
        )}
        <Link href={requirementId ? `/requirements/${requirementId}` : '/requirements'} className="text-sm font-medium text-primary hover:underline">
          Cancel
        </Link>
      </div>
    </form>
  )
}
