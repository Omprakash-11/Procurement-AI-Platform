'use client'

import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { DataTable } from '@/components/data-table/data-table'
import { AiSparkles } from '@/components/evaluation/ai-marker'
import { Button } from '@/components/ui/button'
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge'
import { useFlagAction, useVendorDocuments } from '@/lib/queries/evaluation'
import { cn } from '@/lib/utils'
import { FLAG_TYPE_LABEL, type VendorDocumentsResponse, type VendorFlag } from '@/lib/vendor-detail'
import type { Enums } from '@/types'
import type { ColumnDef } from '@tanstack/react-table'

type ComplianceTabProps = { rfpId: string; entryId: string; initialData: VendorDocumentsResponse; locked: boolean }
type Severity = Enums<'flag_severity'>

const SEVERITY_TONE: Record<Severity, StatusTone> = { high: 'danger', medium: 'warning', low: 'neutral' }
const SEVERITY_LABEL: Record<Severity, string> = { high: 'High', medium: 'Medium', low: 'Low' }
const STATUS_LABEL: Record<Enums<'flag_status'>, string> = { open: 'Open', acknowledged: 'Acknowledged', escalated: 'Escalated' }
const STATUS_TONE: Record<Enums<'flag_status'>, StatusTone> = { open: 'info', acknowledged: 'neutral', escalated: 'warning' }
const FILTERS: ('all' | Severity)[] = ['all', 'high', 'medium', 'low']
const CLAUSE_PREVIEW = 160

// App Flow §4 Tab 3 — Compliance: High / Medium / Low counts, then flags (severity, type, clause
// excerpt — truncated, expandable — status) with Acknowledge / Escalate, filterable by
// severity. Decision P7-7: the clause is shown as a highlighted excerpt; no document viewer.
// Shares the Documents tab's query, so new flags appear when processing finishes.
export function ComplianceTab({ rfpId, entryId, initialData, locked }: ComplianceTabProps) {
  const { data } = useVendorDocuments(rfpId, entryId, initialData)
  const action = useFlagAction(rfpId, entryId)
  const [filter, setFilter] = useState<'all' | Severity>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const counts = { high: 0, medium: 0, low: 0 }
  for (const f of data.flags) counts[f.severity] += 1
  const flags = filter === 'all' ? data.flags : data.flags.filter((f) => f.severity === filter)

  const run = async (flag: VendorFlag, kind: 'acknowledge' | 'escalate') => {
    try {
      await action.mutateAsync({ flagId: flag.id, action: kind })
      toast.success(`Flag ${kind === 'acknowledge' ? 'acknowledged' : 'escalated'}`, { duration: 4000 })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'We could not update the flag.', { duration: 6000 })
    }
  }

  const columns: ColumnDef<VendorFlag, unknown>[] = [
    { id: 'severity', header: 'Severity', cell: ({ row }) => <StatusBadge tone={SEVERITY_TONE[row.original.severity]}>{SEVERITY_LABEL[row.original.severity]}</StatusBadge> },
    {
      id: 'type',
      header: 'Flag',
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 font-medium">
          <AiSparkles />
          {FLAG_TYPE_LABEL[row.original.flagType]}
        </span>
      ),
    },
    { id: 'document', header: 'Document', cell: ({ row }) => <span className="text-muted-foreground">{row.original.fileName}</span> },
    { id: 'status', header: 'Status', cell: ({ row }) => <StatusBadge tone={STATUS_TONE[row.original.status]}>{STATUS_LABEL[row.original.status]}</StatusBadge> },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const f = row.original
        if (locked) return null
        return (
          <div className="flex justify-end gap-1">
            {f.status === 'open' && (
              <Button variant="ghost" size="sm" disabled={action.isPending} onClick={() => run(f, 'acknowledge')}>
                <CheckCircle2 aria-hidden="true" />
                Acknowledge
              </Button>
            )}
            {f.status !== 'escalated' && (
              <Button variant="ghost" size="sm" disabled={action.isPending} onClick={() => run(f, 'escalate')}>
                <AlertTriangle aria-hidden="true" />
                Escalate
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  const subRow = (f: VendorFlag) => {
    const long = (f.clauseText?.length ?? 0) > CLAUSE_PREVIEW
    const open = expanded.has(f.id)
    return (
      <div className="max-w-3xl space-y-2">
        <p className="text-sm text-foreground">{f.explanation}</p>
        {f.clauseText ? (
          <div>
            <blockquote className="border-l-2 border-border bg-status-warning/60 px-3 py-1.5 text-sm text-foreground">
              {long && !open ? `${f.clauseText.slice(0, CLAUSE_PREVIEW)}…` : f.clauseText}
            </blockquote>
            {long && (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                aria-expanded={open}
                onClick={() =>
                  setExpanded((prev) => {
                    const next = new Set(prev)
                    if (next.has(f.id)) next.delete(f.id)
                    else next.add(f.id)
                    return next
                  })
                }
              >
                {open ? 'Show less' : 'Show full clause'}
              </Button>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No matching clause in the document — the risk is a missing provision.</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-6" aria-label="Flag counts by severity">
        {(['high', 'medium', 'low'] as const).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <StatusBadge tone={SEVERITY_TONE[s]}>{SEVERITY_LABEL[s]}</StatusBadge>
            <span className="font-heading text-2xl text-foreground" data-testid={`flag-count-${s}`}>
              {counts[s]}
            </span>
          </div>
        ))}
      </div>
      <div className="flex gap-1" role="group" aria-label="Filter by severity">
        {FILTERS.map((f) => (
          <Button key={f} variant="outline" size="sm" aria-pressed={filter === f} className={cn(filter === f && 'bg-accent text-foreground')} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : SEVERITY_LABEL[f]}
          </Button>
        ))}
      </div>
      <DataTable columns={columns} data={flags} label="Compliance flags" renderSubRow={subRow} />
    </div>
  )
}
