import { NextResponse } from 'next/server'

import { apiError, INTERNAL_ROLES, requireUser, withErrors } from '@/lib/api'

const DROPDOWN_LIMIT = 10 // App Flow §2.3: the 10 most recent unread

// GET /api/notifications — Backend Schema §8.9: unread notifications for the current user.
// RLS (notifications_recipient) already limits rows to the caller. Decision P4-9: real data.
export const GET = withErrors(async function GET() {
  const auth = await requireUser(INTERNAL_ROLES)
  if (!auth.ok) return auth.response

  const [{ data, error }, { count }] = await Promise.all([
    auth.supabase
      .from('notifications')
      .select('id, type, title, body, entity_type, entity_id, created_at')
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(DROPDOWN_LIMIT),
    auth.supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('is_read', false),
  ])
  if (error) return apiError(500, 'load_failed', 'We could not load notifications.')

  return NextResponse.json({ notifications: data, unreadCount: count ?? 0 })
})
