import { NextResponse } from 'next/server'

import { apiError, INTERNAL_ROLES, requireUser } from '@/lib/api'

// PATCH /api/notifications/read-all — Backend Schema §8.9 (App Flow §2.3 "Mark all as read").
export async function PATCH() {
  const auth = await requireUser(INTERNAL_ROLES)
  if (!auth.ok) return auth.response

  const { error } = await auth.supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('recipient_id', auth.userId)
    .eq('is_read', false)
  if (error) return apiError(500, 'update_failed', 'We could not update notifications.')

  return NextResponse.json({ status: 'ok' })
}
