import { createAdminClient } from '@/lib/supabase/server'
import type { Enums, Json } from '@/types'

type LogActivityInput = {
  orgId: string
  actorId: string | null
  actorType: 'profile' | 'vendor' | 'system'
  entityType: Enums<'activity_entity'>
  entityId: string
  action: string
  description: string
  before?: Json | null
  after?: Json | null
  metadata?: Json | null
}

// CLAUDE.md: activity_log is append-only, written via the service role from API routes,
// with before/after JSONB. A failure here must not undo the user's action, so it is
// reported to the server log rather than thrown.
export async function logActivity(input: LogActivityInput): Promise<void> {
  const { error } = await createAdminClient().from('activity_log').insert({
    org_id: input.orgId,
    actor_id: input.actorId,
    actor_type: input.actorType,
    entity_type: input.entityType,
    entity_id: input.entityId,
    action: input.action,
    description: input.description,
    before_state: input.before ?? null,
    after_state: input.after ?? null,
    metadata: input.metadata ?? null,
  })
  if (error) console.error('logActivity failed', input.action, error.message)
}
