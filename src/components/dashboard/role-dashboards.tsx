'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { CheckCircle2, CheckSquare, ClipboardList, Clock, FileBarChart, XCircle } from 'lucide-react'
import Link from 'next/link'

import { ApprovalsTable } from '@/components/approvals/approvals-table'
import { StatCard } from '@/components/dashboard/stat-card'
import { DataTable } from '@/components/data-table/data-table'
import { LocalDate, RelativeTime } from '@/components/dates/local-date'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { REQUIREMENT_STATUS_LABEL, REQUIREMENT_STATUS_TONE } from '@/lib/requirements'
import { formatDuration, type DhDashboardData, type DhRequirement, type FaDashboardData } from '@/lib/role-dashboards'

const requirementColumns: ColumnDef<DhRequirement, unknown>[] = [
  {
    accessorKey: 'title',
    header: 'Requirement',
    cell: ({ row }) => (
      <Link href={`/requirements/${row.original.id}`} className="font-medium text-foreground hover:underline">
        {row.original.title}
      </Link>
    ),
  },
  { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge tone={REQUIREMENT_STATUS_TONE[row.original.status]}>{REQUIREMENT_STATUS_LABEL[row.original.status]}</StatusBadge> },
  { accessorKey: 'updatedAt', header: 'Last Updated', cell: ({ row }) => <RelativeTime value={row.original.updatedAt} /> },
]

type ReadyRow = DhDashboardData['readyForReview'][number]
const readyColumns: ColumnDef<ReadyRow, unknown>[] = [
  {
    accessorKey: 'rfpTitle',
    header: 'RFP',
    cell: ({ row }) => (
      <Link href={`/pipeline/rfp/${row.original.rfpId}/report`} className="font-medium text-foreground hover:underline">
        {row.original.rfpTitle}
      </Link>
    ),
  },
  { accessorKey: 'requirementTitle', header: 'Your Requirement' },
  { accessorKey: 'generatedAt', header: 'Report Ready', cell: ({ row }) => <LocalDate value={row.original.generatedAt} /> },
]

// App Flow §5 Dept Head Dashboard: My Open Requirements, Awaiting My Review, Completed This
// Month; own requirements; evaluations ready for review.
export function DhDashboard({ data }: { data: DhDashboardData }) {
  return (
    <div className="space-y-12">
      <div className="grid grid-cols-3 gap-6">
        <StatCard testId="stat-open-requirements" label="My Open Requirements" value={data.stats.open} spark={data.spark.open} icon={ClipboardList} href="/requirements" />
        <StatCard testId="stat-awaiting-review" label="Awaiting My Review" value={data.stats.awaitingReview} spark={data.spark.awaitingReview} icon={FileBarChart} />
        <StatCard testId="stat-completed" label="Completed This Month" value={data.stats.completedThisMonth} spark={data.spark.completed} icon={CheckCircle2} />
      </div>
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>My requirements</CardTitle>
            <Link href="/requirements" className="text-sm font-medium text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            <DataTable columns={requirementColumns} data={data.requirements} label="My requirements" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Evaluations ready for review</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable columns={readyColumns} data={data.readyForReview} label="Evaluations ready for review" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// App Flow §6 Finance Approver Dashboard: Pending Approvals, Approved / Rejected This Month,
// Average Decision Time; pending list with SLA colours (red overdue, amber < 24 h, green).
export function FaDashboard({ data }: { data: FaDashboardData }) {
  return (
    <div className="space-y-12">
      <div className="grid grid-cols-4 gap-6">
        <StatCard testId="stat-pending" label="Pending Approvals" value={data.stats.pending} spark={data.spark.pending} icon={CheckSquare} href="/approvals" />
        <StatCard testId="stat-approved" label="Approved This Month" value={data.stats.approvedThisMonth} spark={data.spark.approved} icon={CheckCircle2} />
        <StatCard testId="stat-rejected" label="Rejected This Month" value={data.stats.rejectedThisMonth} spark={data.spark.rejected} icon={XCircle} />
        <StatCard testId="stat-avg-decision" label="Average Decision Time" value={formatDuration(data.stats.avgDecisionHours)} spark={data.spark.decisions} icon={Clock} />
      </div>
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Pending approvals</CardTitle>
          <Link href="/approvals" className="text-sm font-medium text-primary hover:underline">
            View queue
          </Link>
        </CardHeader>
        <CardContent>
          <ApprovalsTable rows={data.pending} compact label="Pending approvals" />
        </CardContent>
      </Card>
    </div>
  )
}
