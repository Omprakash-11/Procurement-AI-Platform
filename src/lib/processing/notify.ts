import { createAdminClient } from '@/lib/supabase/server'
import type { Enums } from '@/types'

// In-app notifications raised by the AI pipeline (App Flow §8.3). Written with the service
// role: the pipeline runs after the request that started it, without a user session.

/** The org's (single, active) Procurement Manager. */
export async function findPm(orgId: string): Promise<{ id: string } | null> {
  const { data } = await createAdminClient()
    .from('profiles')
    .select('id')
    .eq('org_id', orgId)
    .eq('role', 'procurement_manager')
    .eq('is_active', true)
    .maybeSingle()
  return data
}

type NotifyInput = {
  orgId: string
  recipientId: string
  type: Enums<'notification_type'>
  title: string
  body: string
  entityType: 'rfp' | 'report'
  entityId: string
}

export async function notify(input: NotifyInput): Promise<void> {
  const { error } = await createAdminClient().from('notifications').insert({
    org_id: input.orgId,
    recipient_id: input.recipientId,
    type: input.type,
    title: input.title,
    body: input.body,
    entity_type: input.entityType,
    entity_id: input.entityId,
  })
  if (error) console.error('notify failed', input.type, error.message)
}
