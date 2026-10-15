'use client'

import { Download, Link as LinkIcon, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { useShareLink } from '@/lib/queries/evaluation'

// App Flow §4 Report Actions (PM only): Export PDF (Tech Stack §10.1 — POST, then the browser
// downloads the returned file) and Copy Share Link (7-day read-only URL, decision P7-6).
// "Submit for Approval" arrives with the approval workflow in Phase 8.
export function ReportActions({ rfpId }: { rfpId: string }) {
  const share = useShareLink(rfpId)
  const [exporting, setExporting] = useState(false)

  const exportPdf = async () => {
    setExporting(true)
    try {
      const res = await fetch(`/api/reports/${rfpId}/export`, { method: 'POST' })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? 'We could not create the PDF.')
      }
      const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'comparison-report.pdf'
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'We could not create the PDF.', { duration: 6000 })
    } finally {
      setExporting(false)
    }
  }

  const copyLink = async () => {
    try {
      const { url } = await share.mutateAsync()
      await navigator.clipboard.writeText(url)
      toast.success('Share link copied — valid for 7 days', { duration: 4000 })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'We could not create the link.', { duration: 6000 })
    }
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={exportPdf} disabled={exporting} aria-busy={exporting || undefined}>
        {exporting ? <Loader2 className="motion-safe:animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
        Export PDF
      </Button>
      <Button variant="outline" onClick={copyLink} disabled={share.isPending}>
        <LinkIcon aria-hidden="true" />
        Copy Share Link
      </Button>
    </div>
  )
}
