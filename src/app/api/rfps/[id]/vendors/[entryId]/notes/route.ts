import { NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity'
import { apiError, requireUser, validationError, withErrors } from '@/lib/api'
import { noteSchema } from '@/lib/schemas/evaluation'
import type { VendorNote } from '@/lib/vendor-detail'

type Params = { params: Promise<{ id: string; entryId: string }> }

// Decision P7-5: internal, append-only notes per vendor per RFP (App Flow §4 Tab 4). Not in
// Backend Schema §8. PM only (RLS vendor_notes_pm_*); vendors have no access at all.
export const GET = withErrors(async function GET(_request: Request, { params }: Params) {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response
  const { id, entryId } = await params
  const { data: entry } = await auth.supabase.from('rfp_vendor_entries').select('id').eq('id', entryId).eq('rfp_id', id).maybeSingle()
  if (!entry) return apiError(404, 'not_found', 'Vendor not found.')
  const { data } = await auth.supabase
    .from('vendor_notes')
    .select('id, body, created_at, profiles(full_name)')
    .eq('rfp_vendor_entry_id', entryId)
    .order('created_at', { ascending: false })
  const notes: VendorNote[] = (data ?? []).map((n) => ({ id: n.id, body: n.body, createdAt: n.created_at, authorName: n.profiles?.full_name ?? 'Unknown' }))
  return NextResponse.json({ notes })
})

export const POST = withErrors(async function POST(request: Request, { params }: Params) {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response
  const { id, entryId } = await params
  const parsed = noteSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return validationError(parsed.error)

  const { data: entry } = await auth.supabase
    .from('rfp_vendor_entries')
    .select('id, org_id, vendor_account_id, rfps(title)')
    .eq('id', entryId)
    .eq('rfp_id', id)
    .maybeSingle()
  if (!entry) return apiError(404, 'not_found', 'Vendor not found.')

  const { data: note, error } = await auth.supabase
    .from('vendor_notes')
    .insert({ org_id: entry.org_id, rfp_vendor_entry_id: entryId, author_id: auth.userId, body: parsed.data.body })
    .select('id, created_at')
    .single()
  if (error || !note) return apiError(500, 'save_failed', 'We could not save the note. Please try again.')

  // The note text stays out of the activity log, which DH / FA can read (#40).
  await logActivity({
    orgId: entry.org_id,
    actorId: auth.userId,
    actorType: 'profile',
    entityType: 'rfp_vendor_entry',
    entityId: entryId,
    action: 'vendor.note_added',
    description: `Internal note added on a vendor for "${entry.rfps?.title ?? 'RFP'}"`,
    metadata: { rfp_id: id, vendor_account_id: entry.vendor_account_id, note_id: note.id },
  })
  return NextResponse.json({ id: note.id, createdAt: note.created_at }, { status: 201 })
})
