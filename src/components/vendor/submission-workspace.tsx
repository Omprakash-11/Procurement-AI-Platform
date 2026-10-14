'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { differenceInCalendarDays, differenceInHours, format } from 'date-fns'
import { AlertCircle, CheckCircle2, FileText, Info, Loader2, RotateCcw, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/rfps/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { VendorStatusBadge } from '@/components/vendor/vendor-status-badge'
import { fetchJson } from '@/lib/fetch-json'
import { ACCEPTED_EXTENSIONS, ACCEPTED_TYPES, MAX_UPLOAD_BYTES } from '@/lib/schemas/vendor-portal'
import { cn } from '@/lib/utils'
import type { ClientVendorRfp } from '@/lib/vendor/portal'

const TYPE_ERROR = 'Only PDF, DOCX, and XLSX files are supported.' // App Flow §10.2
const SIZE_ERROR = 'File exceeds the 50MB limit. Please compress or split the file.'

type UploadRow =
  | { key: string; kind: 'uploading'; file: File; progress: number }
  | { key: string; kind: 'failed'; file: File; error: string }

const BANNERS: Partial<Record<ClientVendorRfp['status'], { tone: 'warning' | 'neutral' | 'success'; text: string }>> = {
  Shortlisted: { tone: 'warning', text: 'Your proposal has been shortlisted for this RFP' },
  'Not Selected': { tone: 'neutral', text: 'Thank you for your proposal. Another vendor has been selected for this RFP.' },
  Contracted: { tone: 'success', text: 'Congratulations — your proposal has been approved. The procurement team will be in touch.' },
}

const formatSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)

function detectType(file: File): string {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
  const byExt = Object.entries(ACCEPTED_TYPES).find(([, kind]) => `.${kind}` === ext)?.[0]
  return file.type && file.type in ACCEPTED_TYPES ? file.type : (byExt ?? file.type)
}

// Upload straight to Storage with progress (decision P6-1: signed upload URL).
function putWithProgress(url: string, file: File, contentType: string, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100))
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Upload failed. Please retry.')))
    xhr.onerror = () => reject(new Error('Upload failed. Please retry.'))
    xhr.send(file)
  })
}

// App Flow §7 Vendor — RFP Submission Page.
export function SubmissionWorkspace({ initial }: { initial: ClientVendorRfp }) {
  const queryClient = useQueryClient()
  const key = ['vendor-rfp', initial.rfpId]
  // "Status badge updates in real time" — 30 s polling (P6 default).
  const { data: rfp = initial } = useQuery({
    queryKey: key,
    queryFn: async () => (await fetchJson<{ rfp: ClientVendorRfp }>(`/api/vendor/rfps/${initial.rfpId}`)).rfp,
    initialData: initial,
    refetchInterval: 30_000,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: key })

  const [uploads, setUploads] = useState<UploadRow[]>([])
  const [inputError, setInputError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const submissionId = useRef<string | null>(initial.submission?.id ?? null)

  const submitted = rfp.submission !== null && rfp.submission.status !== 'in_progress'
  const canEdit = rfp.open && !submitted
  const busy = uploads.some((u) => u.kind === 'uploading')

  const ensureSubmission = async () => {
    if (submissionId.current) return submissionId.current
    const { submissionId: id } = await fetchJson<{ submissionId: string }>('/api/submissions', { method: 'POST', body: JSON.stringify({ rfpId: rfp.rfpId }) })
    submissionId.current = id
    return id
  }

  const upload = async (file: File, key: string) => {
    const contentType = detectType(file)
    setUploads((rows) => [...rows.filter((r) => r.key !== key), { key, kind: 'uploading', file, progress: 0 }])
    try {
      const subId = await ensureSubmission()
      const { path, signedUrl } = await fetchJson<{ path: string; signedUrl: string }>(`/api/submissions/${subId}/documents`, {
        method: 'POST',
        body: JSON.stringify({ action: 'sign', fileName: file.name, fileSize: file.size, mimeType: contentType }),
      })
      await putWithProgress(signedUrl, file, contentType, (progress) =>
        setUploads((rows) => rows.map((r) => (r.key === key && r.kind === 'uploading' ? { ...r, progress } : r)))
      )
      await fetchJson(`/api/submissions/${subId}/documents`, { method: 'POST', body: JSON.stringify({ action: 'confirm', path, fileName: file.name }) })
      setUploads((rows) => rows.filter((r) => r.key !== key))
      await refresh()
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Upload failed. Please retry.'
      setUploads((rows) => rows.map((r) => (r.key === key ? { key, kind: 'failed', file, error } : r)))
    }
  }

  const addFiles = (files: FileList | File[]) => {
    setInputError(null)
    for (const file of Array.from(files)) {
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
      if (!ACCEPTED_EXTENSIONS.includes(ext)) return setInputError(TYPE_ERROR)
      if (file.size > MAX_UPLOAD_BYTES) return setInputError(SIZE_ERROR)
    }
    for (const file of Array.from(files)) void upload(file, `${file.name}-${file.size}-${crypto.randomUUID()}`)
  }

  const removeDocument = async (docId: string) => {
    setRemoving(docId)
    try {
      await fetchJson(`/api/submissions/${submissionId.current}/documents/${docId}`, { method: 'DELETE' })
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'We could not remove the file.', { duration: 6000 })
    } finally {
      setRemoving(null)
    }
  }

  const deadline = rfp.deadline ? new Date(rfp.deadline) : null
  const daysLeft = deadline ? differenceInCalendarDays(deadline, new Date()) : null
  const banner = BANNERS[rfp.status]

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-sm text-muted-foreground">{rfp.orgName}</p>
          <h1 className="mt-1 font-heading text-3xl text-foreground">{rfp.title}</h1>
        </div>
        <VendorStatusBadge status={rfp.status} />
      </div>

      {banner && (
        <p role="status" className={cn('flex items-start gap-2 rounded border p-4 text-sm', banner.tone === 'success' ? 'border-status-success-foreground/30 bg-status-success text-status-success-foreground' : banner.tone === 'warning' ? 'border-status-warning-foreground/30 bg-status-warning text-status-warning-foreground' : 'border-border bg-status-neutral text-status-neutral-foreground')} data-testid="vendor-banner">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {banner.text}
        </p>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-8">
        <Card>
          <CardHeader>
            <CardTitle>RFP details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <dt className="text-muted-foreground">Organisation</dt>
              <dd className="text-foreground">{rfp.orgName}</dd>
              <dt className="text-muted-foreground">Submission deadline</dt>
              <dd className="text-foreground">
                {deadline ? format(deadline, 'd MMM yyyy, HH:mm') : 'No deadline'}
                {/* App Flow §7: countdown when within 7 days */}
                {deadline && daysLeft !== null && daysLeft >= 0 && daysLeft <= 7 && !submitted && (
                  <span className="ml-2 font-medium text-status-warning-foreground" data-testid="countdown">
                    {daysLeft === 0 ? `${Math.max(0, differenceInHours(deadline, new Date()))} hours left` : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`}
                  </span>
                )}
              </dd>
            </dl>
            <p className="max-w-prose whitespace-pre-line text-muted-foreground">{rfp.description}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your proposal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {canEdit && (
              <div>
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOver(false)
                    addFiles(e.dataTransfer.files)
                  }}
                  className={cn('flex flex-col items-center gap-2 rounded border border-dashed border-input p-8 text-center', dragOver && 'border-primary bg-accent/40')}
                  data-testid="drop-zone"
                >
                  <Upload className="size-6 text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm text-foreground">Drag files here, or</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
                    Browse files
                  </Button>
                  <p className="text-xs text-muted-foreground">PDF, DOCX or XLSX · up to 50MB each</p>
                  <input
                    ref={fileInput}
                    type="file"
                    multiple
                    accept=".pdf,.docx,.xlsx"
                    className="sr-only"
                    aria-label="Upload proposal documents"
                    aria-describedby={inputError ? 'upload-error' : undefined}
                    onChange={(e) => {
                      if (e.target.files) addFiles(e.target.files)
                      e.target.value = ''
                    }}
                  />
                </div>
                {inputError && (
                  <p id="upload-error" role="alert" className="mt-1.5 flex items-center gap-1 text-xs text-destructive">
                    <AlertCircle className="size-3 shrink-0" aria-hidden="true" />
                    {inputError}
                  </p>
                )}
              </div>
            )}

            {!canEdit && !submitted && rfp.closedReason && (
              <p role="status" className="flex items-start gap-2 rounded border border-border bg-muted p-3 text-sm text-muted-foreground">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {rfp.closedReason}
              </p>
            )}

            <ul className="divide-y divide-border rounded border border-border" aria-label="Uploaded documents" data-testid="document-list">
              {rfp.documents.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-foreground">{d.fileName}</span>
                  <span className="text-xs text-muted-foreground">{formatSize(d.sizeBytes)}</span>
                  <span className="flex items-center gap-1 text-xs text-status-success-foreground">
                    <CheckCircle2 className="size-3.5" aria-hidden="true" />
                    Uploaded
                  </span>
                  {canEdit && (
                    <Button variant="ghost" size="icon" aria-label={`Remove ${d.fileName}`} title="Remove" disabled={removing === d.id || busy} onClick={() => removeDocument(d.id)}>
                      <X />
                    </Button>
                  )}
                </li>
              ))}
              {uploads.map((u) => (
                <li key={u.key} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-foreground">{u.file.name}</span>
                  <span className="text-xs text-muted-foreground">{formatSize(u.file.size)}</span>
                  {u.kind === 'uploading' ? (
                    <span className="flex w-32 items-center gap-2">
                      <Loader2 className="size-3.5 text-primary motion-safe:animate-spin" aria-hidden="true" />
                      <Progress value={u.progress} className="h-1.5" aria-label={`Uploading ${u.file.name}`} />
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-xs text-destructive" role="alert">
                      <AlertCircle className="size-3.5" aria-hidden="true" />
                      {u.error}
                      <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => upload(u.file, u.key)}>
                        <RotateCcw aria-hidden="true" />
                        Retry
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={`Dismiss ${u.file.name}`} onClick={() => setUploads((rows) => rows.filter((r) => r.key !== u.key))}>
                        <X />
                      </Button>
                    </span>
                  )}
                </li>
              ))}
            </ul>

            {submitted ? (
              <p role="status" className="flex items-center gap-2 text-sm font-medium text-status-success-foreground" data-testid="submitted-message">
                <CheckCircle2 className="size-4" aria-hidden="true" />
                Proposal submitted{rfp.submission?.submittedAt ? ` on ${format(new Date(rfp.submission.submittedAt), 'd MMM yyyy, HH:mm')}` : ''}
              </p>
            ) : (
              canEdit && (
                <div className="flex justify-end">
                  {/* App Flow §7: active only with ≥ 1 successfully uploaded document */}
                  <Button size="lg" disabled={rfp.documents.length === 0 || busy} onClick={() => setConfirmOpen(true)}>
                    Submit Proposal
                  </Button>
                </div>
              )
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Submit your proposal?"
        description="Once submitted, you cannot edit your proposal. Proceed?"
        confirmLabel="Submit Proposal"
        onConfirm={async () => {
          try {
            await fetchJson(`/api/submissions/${submissionId.current}/submit`, { method: 'POST' })
            toast.success('Proposal submitted', { duration: 4000 })
            await refresh()
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'We could not submit your proposal.', { duration: 6000 })
          }
        }}
      />
    </div>
  )
}
