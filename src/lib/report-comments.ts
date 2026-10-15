import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types'

export type ReportComment = { id: string; body: string; createdAt: string; authorName: string }

/** Decision P8-3. RLS (report_comments_read) decides who sees them; newest first. */
export async function loadReportComments(client: SupabaseClient<Database>, rfpId: string): Promise<ReportComment[]> {
  const { data } = await client
    .from('report_comments')
    .select('id, body, created_at, profiles(full_name)')
    .eq('rfp_id', rfpId)
    .order('created_at', { ascending: false })
  return (data ?? []).map((c) => ({ id: c.id, body: c.body, createdAt: c.created_at, authorName: c.profiles?.full_name ?? 'Department head' }))
}
