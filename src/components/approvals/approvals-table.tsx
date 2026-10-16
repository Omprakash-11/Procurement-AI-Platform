'use client'

import type { ColumnDef } from '@tanstack/react-table'
import Link from 'next/link'

import { DataTable } from '@/components/data-table/data-table'
import { LocalDate, formatUtc } from '@/components/dates/local-date'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import type { ApprovalRow } from '@/lib/approval-data'
import { APPROVAL_STATUS_LABEL, APPROVAL_STATUS_TONE, SLA_TONE, slaState } from '@/lib/approvals'

/** App Flow §6 SLA colouring: red overdue, amber within 24 h, green otherwise (pending only). */
export function SlaBadge({ row }: { row: Pick<ApprovalRow, 'status' | 'slaDueAt'> }) {
  const label = `${formatUtc(row.slaDueAt, 'd MMM, HH:mm')} UTC`
  if (row.status !== 'pending') return <span className="text-sm text-muted-foreground">{label}</span>
  const state = slaState(row.slaDueAt)
  return (
    <StatusBadge tone={SLA_TONE[state]} data-sla={state}>
      {state === 'overdue' ? `Overdue · ${label}` : label}
    </StatusBadge>
  )
}

// App Flow §6 Approval Queue: Request Title, RFP, Vendor, Submitted By, Submitted Date, SLA Due,
// Status, Actions ("Review" → /approvals/[id]). The dashboard reuses it with fewer columns.
export function ApprovalsTable({ rows, compact = false, label }: { rows: ApprovalRow[]; compact?: boolean; label: string }) {
  const columns: ColumnDef<ApprovalRow, unknown>[] = [
    {
      id: 'title',
      header: 'Request Title',
      cell: ({ row }) => (
        <Link href={`/approvals/${row.original.id}`} className="font-medium text-foreground hover:underline">
          Vendor selection: {row.original.rfpTitle}
        </Link>
      ),
    },
    ...(compact ? [] : [{ id: 'rfp', header: 'RFP', cell: ({ row }) => row.original.rfpTitle } as ColumnDef<ApprovalRow, unknown>]),
    { id: 'vendor', header: 'Vendor', cell: ({ row }) => row.original.vendorName },
    { id: 'submittedBy', header: 'Submitted By', cell: ({ row }) => row.original.submittedByName },
    { id: 'submittedAt', header: 'Submitted Date', cell: ({ row }) => <LocalDate value={row.original.submittedAt} /> },
    { id: 'sla', header: 'SLA Due', cell: ({ row }) => <SlaBadge row={row.original} /> },
    ...(compact
      ? []
      : [
          {
            id: 'status',
            header: 'Status',
            cell: ({ row }) => <StatusBadge tone={APPROVAL_STATUS_TONE[row.original.status]}>{APPROVAL_STATUS_LABEL[row.original.status]}</StatusBadge>,
          } as ColumnDef<ApprovalRow, unknown>,
        ]),
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/approvals/${row.original.id}`} aria-label={`Review ${row.original.rfpTitle}`}>
              Review
            </Link>
          </Button>
        </div>
      ),
    },
  ]
  return <DataTable columns={columns} data={rows} label={label} />
}
