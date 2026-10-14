'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { format, formatDistanceToNow } from 'date-fns'
import { CheckSquare, FileText, Kanban, Users } from 'lucide-react'
import Link from 'next/link'

import { StatCard } from '@/components/dashboard/stat-card'
import { DataTable } from '@/components/data-table/data-table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge'
import type { PmDashboard as PmDashboardData } from '@/lib/dashboard'
import { RFP_STATUS_LABEL, RFP_STATUS_TONE } from '@/lib/status'

type SnapshotRow = PmDashboardData['snapshot'][number]
type RenewalRow = PmDashboardData['renewals'][number]

// App Flow §4: days remaining colour-coded red < 30, amber < 60, green < 90.
const urgency = (days: number): StatusTone => (days < 30 ? 'danger' : days < 60 ? 'warning' : 'success')

const snapshotColumns: ColumnDef<SnapshotRow, unknown>[] = [
  {
    accessorKey: 'title',
    header: 'RFP',
    cell: ({ row }) => (
      <Link href={`/pipeline/rfp/${row.original.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
        {row.original.title}
      </Link>
    ),
  },
  { accessorKey: 'department', header: 'Department' },
  { accessorKey: 'status', header: 'Stage', cell: ({ row }) => <StatusBadge tone={RFP_STATUS_TONE[row.original.status]}>{RFP_STATUS_LABEL[row.original.status]}</StatusBadge> },
  { accessorKey: 'vendorCount', header: 'Vendors' },
  {
    accessorKey: 'daysSinceActivity',
    header: 'Last activity',
    cell: ({ row }) => (row.original.daysSinceActivity === 0 ? 'Today' : `${row.original.daysSinceActivity} d ago`),
  },
]

const renewalColumns: ColumnDef<RenewalRow, unknown>[] = [
  { accessorKey: 'title', header: 'Contract' },
  { accessorKey: 'vendor', header: 'Vendor' },
  { accessorKey: 'endDate', header: 'Expires', cell: ({ row }) => format(new Date(`${row.original.endDate}T12:00:00`), 'd MMM yyyy') },
  {
    accessorKey: 'daysRemaining',
    header: 'Days remaining',
    cell: ({ row }) => <StatusBadge tone={urgency(row.original.daysRemaining)}>{Math.max(0, row.original.daysRemaining)} days</StatusBadge>,
  },
  {
    id: 'actions',
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <div className="text-right">
        <Link href={`/contracts/${row.original.id}`} className="text-sm font-medium text-primary hover:underline">
          View contract
        </Link>
      </div>
    ),
  },
]

// App Flow §4 PM Dashboard: summary cards, pipeline snapshot, renewal alerts, recent activity.
// Empty states are empty tables (§10.3).
export function PmDashboard({ data }: { data: PmDashboardData }) {
  const { stats } = data
  return (
    <div className="space-y-12">
      <div className="grid grid-cols-4 gap-6">
        <StatCard testId="stat-active-rfps" label="Active RFPs" value={stats.activeRfps.value} spark={stats.activeRfps.spark} icon={Kanban} href="/pipeline" />
        <StatCard testId="stat-vendors" label="Vendors Under Evaluation" value={stats.vendorsUnderEvaluation.value} spark={stats.vendorsUnderEvaluation.spark} icon={Users} />
        <StatCard testId="stat-approvals" label="Pending Approvals" value={stats.pendingApprovals.value} spark={stats.pendingApprovals.spark} icon={CheckSquare} />
        <StatCard testId="stat-expiring" label="Contracts Expiring Soon" value={stats.contractsExpiring.value} spark={stats.contractsExpiring.spark} icon={FileText} href="/contracts" />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Pipeline snapshot</CardTitle>
          <Link href="/pipeline" className="text-sm font-medium text-primary hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardContent>
          <DataTable columns={snapshotColumns} data={data.snapshot} label="Most recently active RFPs" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Renewal alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable columns={renewalColumns} data={data.renewals} label="Contracts expiring within 90 days" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Recent activity</CardTitle>
            <Link href="/activity" className="text-sm font-medium text-primary hover:underline">
              View all activity
            </Link>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border rounded border border-border" aria-label="Recent activity" data-testid="recent-activity">
              {data.activity.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
                  <span className="text-foreground">
                    <span className="font-medium">{a.actorName}</span>{' '}
                    {a.href ? (
                      <Link href={a.href} className="hover:text-primary hover:underline">
                        {a.description}
                      </Link>
                    ) : (
                      a.description
                    )}
                  </span>
                  <time dateTime={a.createdAt} title={new Date(a.createdAt).toLocaleString()} className="shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                  </time>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
