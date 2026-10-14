'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { DataTable } from '@/components/data-table/data-table'
import { TeamInviteForm } from '@/components/team/team-invite-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge'
import { fetchJson } from '@/lib/fetch-json'
import type { TeamMember, TeamMemberStatus } from '@/lib/team'
import { ROLE_LABELS } from '@/lib/roles'

const STATUS: Record<TeamMemberStatus, { label: string; tone: StatusTone }> = {
  active: { label: 'Active', tone: 'success' },
  pending: { label: 'Invite pending', tone: 'warning' },
  deactivated: { label: 'Deactivated', tone: 'neutral' },
}

type InviteResult = { email: string; status: 'sent' | 'error'; message?: string }

// Decision P4-8 / #44: team members after onboarding — list, invite, resend pending invites.
export function TeamSection({ members }: { members: TeamMember[] }) {
  const router = useRouter()
  const [resending, setResending] = useState<string | null>(null)

  const resend = async (member: TeamMember) => {
    if (member.role === 'procurement_manager') return
    setResending(member.id)
    try {
      const { results } = await fetchJson<{ results: InviteResult[] }>('/api/auth/invite-team', {
        method: 'POST',
        body: JSON.stringify({ invites: [{ email: member.email, role: member.role }] }),
      })
      const result = results[0]
      if (result?.status === 'sent') toast.success(`Invite re-sent to ${member.email}`, { duration: 4000 })
      else toast.error(result?.message ?? 'We could not re-send this invite.', { duration: 6000 })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'We could not re-send this invite.', { duration: 6000 })
    } finally {
      setResending(null)
    }
  }

  const columns: ColumnDef<TeamMember, unknown>[] = [
    { accessorKey: 'fullName', header: 'Name' },
    { accessorKey: 'email', header: 'Email', cell: ({ row }) => <span className="text-muted-foreground">{row.original.email}</span> },
    { accessorKey: 'role', header: 'Role', cell: ({ row }) => ROLE_LABELS[row.original.role] },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge tone={STATUS[row.original.status].tone}>{STATUS[row.original.status].label}</StatusBadge>,
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) =>
        row.original.status === 'pending' && row.original.role !== 'procurement_manager' ? (
          <div className="text-right">
            <Button variant="outline" size="sm" disabled={resending === row.original.id} onClick={() => resend(row.original)}>
              Resend invite
            </Button>
          </div>
        ) : null,
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team</CardTitle>
        <CardDescription>Department Heads and Finance Approvers in your organisation.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <DataTable columns={columns} data={members} label="Team members" />
        <div>
          <h3 className="mb-4 text-xl font-semibold text-foreground">Invite team members</h3>
          <TeamInviteForm submitLabel="Send Invites" onAllSent={() => router.refresh()} />
        </div>
      </CardContent>
    </Card>
  )
}
