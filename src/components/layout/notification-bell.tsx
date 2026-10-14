'use client'

import { formatDistanceToNow } from 'date-fns'
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ClipboardList,
  FileText,
  Inbox,
  Sparkles,
  Timer,
  type LucideIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  notificationHref,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useUnreadNotifications,
  type NotificationItem,
} from '@/lib/queries/notifications'
import { useNotificationStore } from '@/stores/useNotificationStore'
import type { Enums } from '@/types'

const TYPE_ICONS: Record<Enums<'notification_type'>, LucideIcon> = {
  vendor_submitted: Inbox,
  scoring_complete: Sparkles,
  extraction_failed: AlertTriangle,
  approval_requested: CheckCircle2,
  approval_sla_warning: Timer,
  approval_decided: CheckCircle2,
  renewal_alert: FileText,
  vendor_status_updated: Inbox,
  requirement_submitted: ClipboardList,
  evaluation_ready: Sparkles,
}

// App Flow §2.3 notification dropdown; Content Guidelines §5.3 bell + badge.
export function NotificationBell() {
  const router = useRouter()
  const { data } = useUnreadNotifications()
  const markAll = useMarkAllNotificationsRead()
  const markOne = useMarkNotificationRead()
  const open = useNotificationStore((s) => s.isDropdownOpen)
  const setOpen = useNotificationStore((s) => s.setDropdownOpen)
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount)

  const unread = data?.unreadCount ?? 0
  useEffect(() => setUnreadCount(unread), [unread, setUnreadCount])

  const onSelect = (n: NotificationItem) => {
    markOne.mutate(n.id)
    setOpen(false)
    router.push(notificationHref(n))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications, ${unread} unread`} title="Notifications">
          <Bell className="!size-5" aria-hidden="true" />
          {/* Phase 4 checklist: the badge renders even when the count is 0 */}
          <span
            data-testid="notification-count"
            className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium leading-none text-destructive-foreground"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 rounded p-0 shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-medium text-foreground">Notifications</p>
          <Button variant="link" size="sm" className="h-auto p-0" disabled={unread === 0 || markAll.isPending} onClick={() => markAll.mutate()}>
            Mark all as read
          </Button>
        </div>
        <ul className="max-h-96 overflow-y-auto" aria-label="Unread notifications">
          {(data?.notifications ?? []).map((n) => {
            const Icon = TYPE_ICONS[n.type]
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => onSelect(n)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none"
                >
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-foreground">{n.title}</span>
                    <span className="block text-xs text-muted-foreground" title={new Date(n.created_at).toLocaleString()}>
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </span>
                  </span>
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                </button>
              </li>
            )
          })}
        </ul>
        <div className="border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              router.push('/activity')
            }}
            className="text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            View all activity
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
