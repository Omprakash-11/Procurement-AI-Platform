'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Download, Pencil, RefreshCw, Upload, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { FormField, fieldA11y } from '@/components/forms/form-field'
import { SubmitButton } from '@/components/forms/submit-button'
import { RfpFormDialog } from '@/components/rfps/rfp-form-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { ContractDetail } from '@/lib/contracts'
import { ApiError, fetchJson } from '@/lib/fetch-json'
import { useCreateRfp } from '@/lib/queries/rfps'
import { alertDaysSchema, contractEditSchema, terminateSchema, type ContractEditInput, type ContractEditValues, type TerminateRequest } from '@/lib/schemas/contract'
import { ACCEPTED_EXTENSIONS } from '@/lib/schemas/vendor-portal'
import { mimeForExtension } from '@/lib/vendor/mime'

type Props = { contract: ContractDetail; departments: string[] }

// App Flow §4 Contract Detail actions (PM): inline alert threshold, edit details, contract file
// upload / download, "Mark as Terminated" (reason required), "Initiate Renewal" (P9 defaults:
// pre-filled Create RFP, then the invite modal pre-filled with this vendor).
export function ContractActions({ contract, departments }: Props) {
  const router = useRouter()
  const terminated = contract.status === 'terminated'
  const [editOpen, setEditOpen] = useState(false)
  const [terminateOpen, setTerminateOpen] = useState(false)
  const [renewOpen, setRenewOpen] = useState(false)
  const create = useCreateRfp()

  return (
    <div className="flex flex-wrap gap-2">
      {!terminated && (
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil aria-hidden="true" />
          Edit Details
        </Button>
      )}
      <Button variant="outline" onClick={() => setRenewOpen(true)}>
        <RefreshCw aria-hidden="true" />
        Initiate Renewal
      </Button>
      {!terminated && (
        <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setTerminateOpen(true)}>
          <XCircle aria-hidden="true" />
          Mark as Terminated
        </Button>
      )}
      <EditDialog contract={contract} open={editOpen} onOpenChange={setEditOpen} onSaved={() => router.refresh()} />
      <TerminateDialog contract={contract} open={terminateOpen} onOpenChange={setTerminateOpen} onDone={() => router.refresh()} />
      <RfpFormDialog
        open={renewOpen}
        onOpenChange={setRenewOpen}
        mode="create"
        departments={departments}
        currency={contract.currency}
        defaults={{
          title: `Renewal — ${contract.title.replace(/ — Contract$/, '')}`,
          description: `Renewal of "${contract.title}" with ${contract.vendorName} (ends ${contract.endDate}).`,
          department: contract.department,
          budgetMax: contract.value,
        }}
        onSubmit={async (body) => {
          const { rfp } = await create.mutateAsync(body)
          setRenewOpen(false)
          toast.success('Renewal RFP created — confirm the vendor invite', { duration: 4000 })
          const q = new URLSearchParams({ inviteEmail: contract.vendorEmail, inviteCompany: contract.vendorName })
          router.push(`/pipeline/rfp/${rfp.id}?${q.toString()}`)
        }}
      />
    </div>
  )
}

/** App Flow §4: "inline editable field — PM can change the renewal alert window at any time". */
export function AlertDaysEditor({ contractId, value, disabled }: { contractId: string; value: number; disabled: boolean }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const parsed = alertDaysSchema.safeParse(draft)
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Enter a number of days.')
    if (parsed.data === value) return setEditing(false)
    setSaving(true)
    try {
      await fetchJson(`/api/contracts/${contractId}`, { method: 'PATCH', body: JSON.stringify({ alertDays: parsed.data }) })
      setEditing(false)
      setError(null)
      toast.success('Renewal alert updated', { duration: 4000 })
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not save the alert threshold.')
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setEditing(true)}
        className="rounded text-left text-foreground hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:hover:bg-transparent"
        title={disabled ? undefined : 'Click to change'}
        data-testid="alert-days"
      >
        {value} days before end date
      </button>
    )
  }
  return (
    <div>
      <div className="flex items-center gap-2">
        <Input
          autoFocus
          type="number"
          min={1}
          max={730}
          className="h-8 w-24"
          aria-label="Renewal alert threshold in days"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'alert-days-error' : undefined}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save()
            if (e.key === 'Escape') {
              setDraft(String(value))
              setError(null)
              setEditing(false)
            }
          }}
        />
        <span className="text-sm text-muted-foreground">days</span>
        <Button size="sm" disabled={saving} onClick={save}>
          Save
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setDraft(String(value))
            setError(null)
            setEditing(false)
          }}
        >
          Cancel
        </Button>
      </div>
      {error && (
        <p id="alert-days-error" role="alert" className="mt-1.5 flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="size-3" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  )
}

/** App Flow §4 "Document section: uploaded contract file with Download button" (+ upload / replace). */
export function ContractDocument({ contract }: { contract: ContractDetail }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const upload = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    const mimeType = mimeForExtension(file.name)
    if (!mimeType) return setError('Only PDF, DOCX, and XLSX files are supported.')
    setUploading(true)
    try {
      const { path, signedUrl } = await fetchJson<{ path: string; signedUrl: string }>(`/api/contracts/${contract.id}/document`, {
        method: 'POST',
        body: JSON.stringify({ action: 'sign', fileName: file.name, fileSize: file.size, mimeType }),
      })
      const put = await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': mimeType }, body: file })
      if (!put.ok) throw new Error('Upload failed. Please retry.')
      await fetchJson(`/api/contracts/${contract.id}/document`, { method: 'POST', body: JSON.stringify({ action: 'confirm', fileName: file.name, path }) })
      toast.success('Contract file uploaded', { duration: 4000 })
      router.refresh()
    } catch (err) {
      setError(err instanceof ApiError ? (err.body.fields?.file?.[0] ?? err.message) : err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      {contract.hasDocument ? (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-foreground" data-testid="contract-file">
            {contract.documentName}
          </span>
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/contracts/${contract.id}/document`} download>
              <Download aria-hidden="true" />
              Download
            </a>
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No contract file uploaded yet.</p>
      )}
      <input ref={input} type="file" className="sr-only" accept={ACCEPTED_EXTENSIONS.join(',')} aria-label="Upload contract file" onChange={(e) => upload(e.target.files?.[0])} />
      <Button variant="ghost" size="sm" disabled={uploading} onClick={() => input.current?.click()}>
        <Upload aria-hidden="true" />
        {uploading ? 'Uploading…' : contract.hasDocument ? 'Replace file' : 'Upload file'}
      </Button>
      {error && (
        <p role="alert" className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="size-3" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  )
}

function EditDialog({ contract, open, onOpenChange, onSaved }: { contract: ContractDetail; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const form = useForm<ContractEditInput, unknown, ContractEditValues>({
    resolver: zodResolver(contractEditSchema),
    values: { title: contract.title, value: contract.value ?? '', paymentTerms: contract.paymentTerms ?? '', startDate: contract.startDate, endDate: contract.endDate },
  })
  const { errors, isSubmitting } = form.formState

  const submit = form.handleSubmit(async (v) => {
    try {
      await fetchJson(`/api/contracts/${contract.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: v.title, value: v.value, paymentTerms: v.paymentTerms || null, startDate: v.startDate, endDate: v.endDate }),
      })
      onOpenChange(false)
      toast.success('Contract updated', { duration: 4000 })
      onSaved()
    } catch (err) {
      const fields = err instanceof ApiError ? err.body.fields : undefined
      if (fields?.endDate?.[0]) return form.setError('endDate', { message: fields.endDate[0] })
      form.setError('root', { message: err instanceof Error ? err.message : 'We could not update the contract.' })
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded">
        <DialogHeader>
          <DialogTitle>Edit contract</DialogTitle>
          <DialogDescription>Contracts start with a one-year default term — set the real value, terms and dates here.</DialogDescription>
        </DialogHeader>
        <form method="post" onSubmit={submit} noValidate className="space-y-5">
          <FormField id="contract-title" label="Contract name" required error={errors.title?.message}>
            <Input {...fieldA11y('contract-title', errors.title?.message)} {...form.register('title')} />
          </FormField>
          <FormField id="contract-value" label={`Contract value (${contract.currency})`} error={errors.value?.message}>
            <Input type="number" min={0} step="any" inputMode="decimal" {...fieldA11y('contract-value', errors.value?.message)} {...form.register('value')} />
          </FormField>
          <FormField id="contract-terms" label="Payment terms" error={errors.paymentTerms?.message}>
            <Textarea className="min-h-[72px] resize-y rounded" {...fieldA11y('contract-terms', errors.paymentTerms?.message)} {...form.register('paymentTerms')} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField id="contract-start" label="Start date" required error={errors.startDate?.message}>
              <Input type="date" {...fieldA11y('contract-start', errors.startDate?.message)} {...form.register('startDate')} />
            </FormField>
            <FormField id="contract-end" label="End date" required error={errors.endDate?.message}>
              <Input type="date" {...fieldA11y('contract-end', errors.endDate?.message)} {...form.register('endDate')} />
            </FormField>
          </div>
          {errors.root?.message && (
            <p role="alert" className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="size-3" aria-hidden="true" />
              {errors.root.message}
            </p>
          )}
          <DialogFooter className="gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <SubmitButton pending={isSubmitting} pendingLabel="Saving contract">
              Save Changes
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function TerminateDialog({ contract, open, onOpenChange, onDone }: { contract: ContractDetail; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const form = useForm<TerminateRequest>({ resolver: zodResolver(terminateSchema), defaultValues: { reason: '' } })
  const { errors, isSubmitting } = form.formState

  const submit = form.handleSubmit(async (v) => {
    try {
      await fetchJson(`/api/contracts/${contract.id}/terminate`, { method: 'PATCH', body: JSON.stringify(v) })
      onOpenChange(false)
      toast.success('Contract terminated', { duration: 4000 })
      onDone()
    } catch (err) {
      const field = err instanceof ApiError ? err.body.fields?.reason?.[0] : undefined
      form.setError('reason', { message: field ?? (err instanceof Error ? err.message : 'We could not terminate the contract.') })
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded">
        <DialogHeader>
          <DialogTitle>Terminate this contract?</DialogTitle>
          <DialogDescription>It is marked Terminated and no longer raises renewal alerts. This can&apos;t be undone.</DialogDescription>
        </DialogHeader>
        <form method="post" onSubmit={submit} noValidate className="space-y-5">
          <FormField id="terminate-reason" label="Reason" required error={errors.reason?.message}>
            <Textarea className="min-h-[96px] resize-y rounded" {...fieldA11y('terminate-reason', errors.reason?.message)} {...form.register('reason')} />
          </FormField>
          <DialogFooter className="gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <SubmitButton pending={isSubmitting} pendingLabel="Terminating contract" variant="destructive">
              Mark as Terminated
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
