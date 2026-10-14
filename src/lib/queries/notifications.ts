'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { fetchJson } from '@/lib/fetch-json'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/types'

export type NotificationItem = Pick<Tables<'notifications'>, 'id' | 'type' | 'title' | 'body' | 'entity_type' | 'entity_id' | 'created_at'>
type NotificationsResponse = { notifications: NotificationItem[]; unreadCount: number }

const NOTIFICATIONS_KEY = ['notifications', 'unread'] as const

// TanStack Query holds the data (Tech Stack §7.2 — never Zustand). Polls every 30 s.
export function useUnreadNotifications() {
  return useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: () => fetchJson<NotificationsResponse>('/api/notifications'),
    refetchInterval: 30_000,
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => fetchJson('/api/notifications/read-all', { method: 'PATCH' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  })
}

// Marking one notification read isn't an audited state change; RLS limits it to the recipient.
export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await createClient()
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  })
}

/** Deep-link target for a notification (App Flow §2.3). */
export function notificationHref(n: Pick<NotificationItem, 'entity_type' | 'entity_id'>): string {
  if (!n.entity_id) return '/activity'
  switch (n.entity_type) {
    case 'rfp':
      return `/pipeline/rfp/${n.entity_id}`
    case 'contract':
      return `/contracts/${n.entity_id}`
    case 'approval_request':
      return `/approvals/${n.entity_id}`
    case 'requirement':
      return `/requirements/${n.entity_id}`
    default:
      return '/activity'
  }
}
