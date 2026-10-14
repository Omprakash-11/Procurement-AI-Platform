'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import Link from 'next/link'

import { DataTable } from '@/components/data-table/data-table'
import { VendorStatusBadge } from '@/components/vendor/vendor-status-badge'
import type { VendorFacingStatus } from '@/lib/vendor/portal'

export type MyRfpRow = { rfpId: string; title: string; orgName: string; deadline: string | null; status: VendorFacingStatus }

const columns: ColumnDef<MyRfpRow, unknown>[] = [
  { accessorKey: 'title', header: 'RFP Title', cell: ({ row }) => <span className="font-medium">{row.original.title}</span> },
  { accessorKey: 'orgName', header: 'Organisation' },
  {
    accessorKey: 'deadline',
    header: 'Submission Deadline',
    cell: ({ row }) => (row.original.deadline ? format(new Date(row.original.deadline), 'd MMM yyyy') : '—'),
  },
  { accessorKey: 'status', header: 'Status', cell: ({ row }) => <VendorStatusBadge status={row.original.status} /> },
  {
    id: 'action',
    header: () => <span className="sr-only">Action</span>,
    cell: ({ row }) => (
      <div className="text-right">
        <Link href={`/vendor/rfp/${row.original.rfpId}`} className="text-sm font-medium text-primary hover:underline">
          View / Submit
        </Link>
      </div>
    ),
  },
]

// App Flow §7 "My RFPs": RFP Title, Organisation, Submission Deadline, Status, Action.
export function MyRfpsTable({ rows }: { rows: MyRfpRow[] }) {
  return <DataTable columns={columns} data={rows} label="My RFPs" />
}
