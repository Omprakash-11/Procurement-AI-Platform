import type { SupabaseClient } from '@supabase/supabase-js'

import { storedTemplateCriteria } from '@/lib/schemas/evaluation'
import type { Database } from '@/types'

export type ScoringTemplate = {
  id: string
  name: string
  lastUsedAt: string | null
  updatedAt: string
  criteria: { name: string; description: string | null; weight: number }[]
}

/** The org's templates (RLS: PM only), most recently used first. */
export async function loadTemplates(client: SupabaseClient<Database>): Promise<ScoringTemplate[]> {
  const { data } = await client
    .from('scoring_templates')
    .select('id, name, criteria, last_used_at, updated_at')
    .eq('is_deleted', false)
    .order('last_used_at', { ascending: false, nullsFirst: false })
    .order('name')
  return (data ?? []).map((t) => {
    const parsed = storedTemplateCriteria.safeParse(t.criteria)
    const criteria = parsed.success
      ? [...parsed.data].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((c) => ({ name: c.name, description: c.description ?? null, weight: c.weight }))
      : []
    return { id: t.id, name: t.name, lastUsedAt: t.last_used_at, updatedAt: t.updated_at, criteria }
  })
}
