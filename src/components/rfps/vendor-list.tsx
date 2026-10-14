'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { ExternalLink, Star, StarOff, Trash2, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { DataTable } from '@/components/data-table/data-table'
import { ConfirmDialog } from '@/components/rfps/confirm-dialog'
import { InviteVendorDialog } from '@/components/rfps/invite-vendor-dialog'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { useVendorAction } from '@/lib/queries/rfps'
import type { RfpVendorRow } from '@/lib/rfps'
import { SHORTLISTABLE, VENDOR_STATUS_LABEL, VENDOR_STATUS_TONE } from '@/lib/status'

type VendorListProps = { rfpId: string; vendors: RfpVendorRow[]; canInvite: boolean; readOnly: boolean }

// App Flow §4 RFP Detail — right panel. Columns: Vendor Name, Status, Documents, Compliance
// Flags, Score (if scored), Actions (View Details | Shortlist toggle | Remove).
export function VendorList({ rfpId, vendors, canInvite, readOnly }: VendorListProps) {
  const router = useRouter()
  const action = useVendorAction(rfpId)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [removing, setRemoving] = useState<RfpVendorRow | null>(null)

  const run = async (row: RfpVendorRow, kind: 'shortlist' | 'unshortlist' | 'remove') => {
    try {
      await action.mutateAsync({ entryId: row.entryId, action: kind })
      const done = { shortlist: 'shortlisted', unshortlist: 'moved back to Under Review', remove: 'removed' }[kind]
      toast.success(`${row.companyName} ${done}`, { duration: 4000 })
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'We could not update this vendor.', { duration: 6000 })
    }
  }

  const columns: ColumnDef<RfpVendorRow, unknown>[] = [
    {
      accessorKey: 'companyName',
      header: 'Vendor Name',
      cell: ({ row }) => (
        <div>
          <span className="font-medium text-foreground">{row.original.companyName}</span>
          <span className="block text-xs text-muted-foreground">{row.original.email}</span>
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) =>
        row.original.removed ? (
          <StatusBadge tone="neutral">Removed</StatusBadge>
        ) : (
          <StatusBadge tone={VENDOR_STATUS_TONE[row.original.status]}>{VENDOR_STATUS_LABEL[row.original.status]}</StatusBadge>
        ),
    },
    { accessorKey: 'documentCount', header: 'Documents' },
    { accessorKey: 'flagCount', header: 'Compliance Flags' },
    { accessorKey: 'score', header: 'Score', cell: ({ row }) => (row.original.score === null ? '—' : row.original.score.toFixed(1)) },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const v = row.original
        return (
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/pipeline/rfp/${rfpId}/vendor/${v.vendorAccountId}`}>
                <ExternalLink aria-hidden="true" />
                View Details
              </Link>
            </Button>
            {!readOnly && SHORTLISTABLE.includes(v.status) && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={v.status === 'shortlisted' ? `Remove ${v.companyName} from shortlist` : `Shortlist ${v.companyName}`}
                aria-pressed={v.status === 'shortlisted'}
                title={v.status === 'shortlisted' ? 'Remove from shortlist' : 'Shortlist'}
                disabled={action.isPending}
                onClick={() => run(v, v.status === 'shortlisted' ? 'unshortlist' : 'shortlist')}
              >
                {v.status === 'shortlisted' ? <StarOff /> : <Star />}
              </Button>
            )}
            {!readOnly && v.status === 'invited' && (
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                aria-label={`Remove ${v.companyName}`}
                title="Remove"
                onClick={() => setRemoving(v)}
              >
                <Trash2 />
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <section aria-label="Vendors" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Vendors</h2>
        {canInvite && !readOnly && (
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus aria-hidden="true" />
            Invite Vendor
          </Button>
        )}
      </div>
      <DataTable columns={columns} data={vendors} label="Vendors invited to this RFP" />

      <InviteVendorDialog rfpId={rfpId} open={inviteOpen} onOpenChange={setInviteOpen} onInvited={() => router.refresh()} />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove ${removing?.companyName ?? 'this vendor'}?`}
        description="Their invite link stops working and they're marked Not Selected. The record stays in this RFP's history."
        confirmLabel="Remove Vendor"
        destructive
        onConfirm={async () => {
          if (removing) await run(removing, 'remove')
        }}
      />
    </section>
  )
}
