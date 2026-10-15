'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import Link from 'next/link'

import { DataTable } from '@/components/data-table/data-table'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TONE, daysTone, type ContractRow } from '@/lib/contracts'
import { formatMoney } from '@/lib/rfps'

const date = (d: string) => format(new Date(`${d}T12:00:00`), 'd MMM yyyy')

export function DaysRemaining({ row }: { row: Pick<ContractRow, 'daysRemaining' | 'alertDays' | 'status'> }) {
  if (row.status === 'terminated') return <span className="text-muted-foreground">—</span>
  const label = row.daysRemaining <= 0 ? (row.daysRemaining === 0 ? 'Ends today' : `${-row.daysRemaining} days ago`) : `${row.daysRemaining} days`
  return (
    <StatusBadge tone={daysTone(row.daysRemaining, row.alertDays, row.status)} data-testid="days-remaining">
      {label}
    </StatusBadge>
  )
}

// App Flow §4 Contracts List: Contract Name, Vendor, RFP, Value, Start Date, End Date, Days
// Remaining (colour-coded, P9 defaults), Status, Actions.
export function ContractsTable({ rows }: { rows: ContractRow[] }) {
  const columns: ColumnDef<ContractRow, unknown>[] = [
    {
      accessorKey: 'title',
      header: 'Contract Name',
      cell: ({ row }) => (
        <Link href={`/contracts/${row.original.id}`} className="font-medium text-foreground hover:underline">
          {row.original.title}
        </Link>
      ),
    },
    { accessorKey: 'vendorName', header: 'Vendor' },
    { accessorKey: 'rfpTitle', header: 'RFP' },
    { accessorKey: 'value', header: 'Value', cell: ({ row }) => formatMoney(row.original.value, row.original.currency) },
    { accessorKey: 'startDate', header: 'Start Date', cell: ({ row }) => date(row.original.startDate) },
    { accessorKey: 'endDate', header: 'End Date', cell: ({ row }) => date(row.original.endDate) },
    { id: 'days', header: 'Days Remaining', cell: ({ row }) => <DaysRemaining row={row.original} /> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge tone={CONTRACT_STATUS_TONE[row.original.status]}>{CONTRACT_STATUS_LABEL[row.original.status]}</StatusBadge> },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/contracts/${row.original.id}`} aria-label={`View ${row.original.title}`}>
              View
            </Link>
          </Button>
        </div>
      ),
    },
  ]
  return <DataTable columns={columns} data={rows} label="Contracts" />
}
