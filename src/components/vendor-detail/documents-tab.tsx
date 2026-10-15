'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import { AlertCircle, ChevronDown, ChevronRight, Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { DataTable } from '@/components/data-table/data-table'
import { AiExtractedLabel } from '@/components/evaluation/ai-marker'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { useRetryDocument, useVendorDocuments } from '@/lib/queries/evaluation'
import { EXTRACTION_FIELDS, type VendorDocument, type VendorDocumentsResponse } from '@/lib/vendor-detail'

type DocumentsTabProps = { rfpId: string; entryId: string; initialData: VendorDocumentsResponse }

/** Matches STALE_PROCESSING_MS on the server: a run this old was cut off and may be retried. */
const STALE_MS = 6 * 60_000

const formatSize = (bytes: number) => (bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)

// App Flow §4 Tab 1 — Documents: filename, type icon, upload date, processing status, Download.
// Extracted → "View Extracted Data" expander; Failed → red banner "Extraction failed. [Retry]".
// Polls every 5 s while anything is queued / processing (Tech Stack §11.1). No inline viewer.
export function DocumentsTab({ rfpId, entryId, initialData }: DocumentsTabProps) {
  const { data } = useVendorDocuments(rfpId, entryId, initialData)
  const retry = useRetryDocument(rfpId, entryId)
  const [open, setOpen] = useState<Set<string>>(new Set())

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const runRetry = async (doc: VendorDocument) => {
    try {
      await retry.mutateAsync(doc.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'We could not retry this document.', { duration: 6000 })
    }
  }

  const isStale = (doc: VendorDocument) => (doc.status === 'processing' || doc.status === 'queued') && Date.now() - new Date(doc.updatedAt).getTime() > STALE_MS

  const columns: ColumnDef<VendorDocument, unknown>[] = [
    {
      accessorKey: 'fileName',
      header: 'File',
      cell: ({ row }) => {
        const Icon = row.original.fileType === 'xlsx' ? FileSpreadsheet : FileText
        return (
          <span className="flex items-center gap-2">
            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="font-medium">{row.original.fileName}</span>
            <span className="text-xs uppercase text-muted-foreground">{row.original.fileType}</span>
          </span>
        )
      },
    },
    { accessorKey: 'fileSizeBytes', header: 'Size', cell: ({ row }) => formatSize(row.original.fileSizeBytes) },
    { accessorKey: 'uploadedAt', header: 'Uploaded', cell: ({ row }) => format(new Date(row.original.uploadedAt), 'd MMM yyyy') },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const doc = row.original
        if (doc.status === 'queued') return <StatusBadge tone="neutral">Queued</StatusBadge>
        if (doc.status === 'processing')
          return (
            <StatusBadge tone="info">
              <Loader2 className="size-3 motion-safe:animate-spin" aria-hidden="true" />
              Processing
            </StatusBadge>
          )
        if (doc.status === 'extracted') return <StatusBadge tone="success">Extracted</StatusBadge>
        return <StatusBadge tone="danger">Failed</StatusBadge>
      },
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const doc = row.original
        return (
          <div className="flex items-center justify-end gap-1">
            {doc.status === 'extracted' && (
              <Button variant="ghost" size="sm" aria-expanded={open.has(doc.id)} onClick={() => toggle(doc.id)}>
                {open.has(doc.id) ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
                View Extracted Data
              </Button>
            )}
            {isStale(doc) && (
              <Button variant="ghost" size="sm" disabled={retry.isPending} onClick={() => runRetry(doc)}>
                Retry
              </Button>
            )}
            <Button variant="ghost" size="sm" asChild>
              <a href={`/api/submissions/${data.submissionId}/documents/${doc.id}/download`} download>
                <Download aria-hidden="true" />
                Download
              </a>
            </Button>
          </div>
        )
      },
    },
  ]

  const subRow = (doc: VendorDocument) => {
    if (doc.status === 'processing') {
      // Content Guidelines §8.1 processing indicator.
      return (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 text-primary motion-safe:animate-spin" aria-hidden="true" />
          Analysing with AI…
        </p>
      )
    }
    if (doc.status === 'failed') {
      return (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded bg-status-danger px-3 py-2 text-status-danger-foreground">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          <span className="text-sm">Extraction failed.</span>
          {doc.error && <span className="text-sm">{doc.error}</span>}
          <Button variant="ghost" size="sm" className="ml-auto text-xs" disabled={retry.isPending} onClick={() => runRetry(doc)}>
            Retry
          </Button>
        </div>
      )
    }
    if (doc.status === 'extracted' && open.has(doc.id)) {
      return doc.extraction ? (
        <div className="space-y-3 rounded border border-border p-4">
          <AiExtractedLabel />
          <dl className="grid grid-cols-[minmax(0,12rem)_1fr] gap-x-6 gap-y-2">
            {EXTRACTION_FIELDS.map((f) => (
              <div key={f.key} className="contents">
                <dt className="text-sm text-muted-foreground">{f.label}</dt>
                <dd className="whitespace-pre-line text-sm text-foreground">{doc.extraction?.[f.key] ?? 'Not stated'}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">The extracted data could not be read. Retry the extraction.</p>
      )
    }
    return null
  }

  return <DataTable columns={columns} data={data.documents} label="Submitted documents" renderSubRow={subRow} />
}
