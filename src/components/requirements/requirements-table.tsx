'use client'

import type { ColumnDef } from '@tanstack/react-table'
import Link from 'next/link'

import { DataTable } from '@/components/data-table/data-table'
import { LocalDate } from '@/components/dates/local-date'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { PRIORITY_LABEL, REQUIREMENT_STATUS_LABEL, REQUIREMENT_STATUS_TONE } from '@/lib/requirements'
import type { Enums } from '@/types'

export type RequirementRow = {
  id: string
  title: string
  department: string
  priority: Enums<'requirement_priority'>
  status: Enums<'requirement_status'>
  createdAt: string
  raisedBy: string
}

// App Flow §5 Requirements List: Title, Department, Priority, Status, Submitted Date, Actions.
// The PM's view (all requirements) adds who raised each one.
export function RequirementsTable({ rows, showRaisedBy }: { rows: RequirementRow[]; showRaisedBy: boolean }) {
  const columns: ColumnDef<RequirementRow, unknown>[] = [
    {
      accessorKey: 'title',
      header: 'Requirement Title',
      cell: ({ row }) => (
        <Link href={`/requirements/${row.original.id}`} className="font-medium text-foreground hover:underline">
          {row.original.title}
        </Link>
      ),
    },
    ...(showRaisedBy ? [{ accessorKey: 'raisedBy', header: 'Raised By' } as ColumnDef<RequirementRow, unknown>] : []),
    { accessorKey: 'department', header: 'Department' },
    { accessorKey: 'priority', header: 'Priority', cell: ({ row }) => PRIORITY_LABEL[row.original.priority] },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge tone={REQUIREMENT_STATUS_TONE[row.original.status]}>{REQUIREMENT_STATUS_LABEL[row.original.status]}</StatusBadge>,
    },
    { accessorKey: 'createdAt', header: 'Submitted Date', cell: ({ row }) => <LocalDate value={row.original.createdAt} /> },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/requirements/${row.original.id}`} aria-label={`View ${row.original.title}`}>
              View
            </Link>
          </Button>
        </div>
      ),
    },
  ]
  return <DataTable columns={columns} data={rows} label="Requirements" />
}
