import { NextResponse } from 'next/server'

import { apiError } from '@/lib/api'
import { getAppClaims } from '@/lib/auth/claims'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import type { Enums } from '@/types'

// Vendor portal data access (decision P2-4). Vendors have no RLS access to rfps,
// organisations or documents, so these helpers read with the service role — always scoped
// to the signed-in vendor's own vendor_accounts — and return ONLY whitelisted fields.
// Never add scores, flags, budgets, notes, extraction data or other vendors here.

export type VendorAuth = { ok: true; userId: string; email: string } | { ok: false; response: NextResponse }

export async function requireVendor(): Promise<VendorAuth> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return { ok: false, response: apiError(401, 'unauthenticated', 'Your session has expired. Please sign in again.') }
  const { data: session } = await supabase.auth.getSession()
  if (getAppClaims(session.session?.access_token).user_type !== 'vendor') {
    return { ok: false, response: apiError(403, 'forbidden', 'You do not have permission to do that.') }
  }
  return { ok: true, userId: data.user.id, email: data.user.email ?? '' }
}

export type VendorFacingStatus = 'Invited' | 'Submitted' | 'Under Review' | 'Shortlisted' | 'Not Selected' | 'Contracted'

// App Flow §7 vendor statuses (P6 defaults): internal Approved → Shortlisted; a vendor removed
// before submitting sees Not Selected.
export function vendorFacingStatus(status: Enums<'vendor_pipeline_status'>): VendorFacingStatus {
  switch (status) {
    case 'invited':
      return 'Invited'
    case 'submitted':
      return 'Submitted'
    case 'under_review':
      return 'Under Review'
    case 'shortlisted':
    case 'approved':
      return 'Shortlisted'
    case 'not_selected':
      return 'Not Selected'
    case 'contracted':
      return 'Contracted'
  }
}

export type VendorDocument = { id: string; fileName: string; fileType: Enums<'document_type'>; sizeBytes: number; uploadedAt: string }

export type VendorRfp = {
  rfpId: string
  title: string
  description: string
  deadline: string | null
  orgName: string
  status: VendorFacingStatus
  /** P6-3: uploads / submit allowed right now. */
  open: boolean
  closedReason: string | null
  submission: { id: string; status: Enums<'submission_status'>; submittedAt: string | null } | null
  documents: VendorDocument[]
  // Internal ids for server routes only — never rendered.
  orgId: string
  vendorAccountId: string
  entryId: string
}

const CLOSED_RFP_STATUSES = ['approval_pending', 'contracted', 'archived']

type EntryRow = {
  id: string
  status: Enums<'vendor_pipeline_status'>
  vendor_account_id: string
  org_id: string
  rfps: { id: string; title: string; description: string; submission_deadline: string | null; status: Enums<'rfp_status'>; is_deleted: boolean; organisations: { name: string } | null } | null
}

function closedReason(entry: EntryRow, submitted: boolean): string | null {
  const rfp = entry.rfps
  if (!rfp) return 'This RFP is no longer available.'
  if (submitted) return null
  if (entry.status === 'not_selected') return 'This invitation is no longer active.'
  if (CLOSED_RFP_STATUSES.includes(rfp.status)) return 'This RFP is no longer accepting proposals.'
  if (rfp.submission_deadline && new Date(rfp.submission_deadline) < new Date()) return 'The submission deadline has passed.'
  return null
}

/** All RFPs the vendor (across every org they work with) has been invited to. */
export async function listVendorRfps(userId: string): Promise<Omit<VendorRfp, 'documents' | 'description'>[]> {
  const admin = createAdminClient()
  const { data: accounts } = await admin.from('vendor_accounts').select('id').eq('auth_user_id', userId).eq('is_deleted', false).eq('is_active', true)
  const accountIds = (accounts ?? []).map((a) => a.id)
  if (!accountIds.length) return []

  const [{ data: entries }, { data: submissions }] = await Promise.all([
    admin
      .from('rfp_vendor_entries')
      .select('id, status, vendor_account_id, org_id, rfps(id, title, description, submission_deadline, status, is_deleted, organisations(name))')
      .in('vendor_account_id', accountIds)
      .order('created_at', { ascending: false }),
    admin.from('submissions').select('id, rfp_id, vendor_account_id, status, submitted_at').in('vendor_account_id', accountIds),
  ])

  return ((entries ?? []) as EntryRow[])
    .filter((e) => e.rfps && !e.rfps.is_deleted)
    .map((e) => {
      const sub = (submissions ?? []).find((s) => s.rfp_id === e.rfps!.id && s.vendor_account_id === e.vendor_account_id) ?? null
      const submitted = Boolean(sub && sub.status !== 'in_progress')
      const reason = closedReason(e, submitted)
      return {
        rfpId: e.rfps!.id,
        title: e.rfps!.title,
        deadline: e.rfps!.submission_deadline,
        orgName: e.rfps!.organisations?.name ?? '',
        status: vendorFacingStatus(e.status),
        open: !submitted && reason === null,
        closedReason: reason,
        submission: sub ? { id: sub.id, status: sub.status, submittedAt: sub.submitted_at } : null,
        orgId: e.org_id,
        vendorAccountId: e.vendor_account_id,
        entryId: e.id,
      }
    })
}

/** One RFP for the signed-in vendor, or null if they were never invited to it. */
export async function getVendorRfp(userId: string, rfpId: string): Promise<VendorRfp | null> {
  const admin = createAdminClient()
  const { data: accounts } = await admin.from('vendor_accounts').select('id').eq('auth_user_id', userId).eq('is_deleted', false).eq('is_active', true)
  const accountIds = (accounts ?? []).map((a) => a.id)
  if (!accountIds.length) return null

  const { data: entry } = await admin
    .from('rfp_vendor_entries')
    .select('id, status, vendor_account_id, org_id, rfps(id, title, description, submission_deadline, status, is_deleted, organisations(name))')
    .eq('rfp_id', rfpId)
    .in('vendor_account_id', accountIds)
    .maybeSingle()
  const e = entry as EntryRow | null
  if (!e?.rfps || e.rfps.is_deleted) return null

  const { data: sub } = await admin
    .from('submissions')
    .select('id, status, submitted_at, documents(id, file_name, file_type, file_size_bytes, created_at)')
    .eq('rfp_id', rfpId)
    .eq('vendor_account_id', e.vendor_account_id)
    .maybeSingle()

  const submitted = Boolean(sub && sub.status !== 'in_progress')
  const reason = closedReason(e, submitted)
  return {
    rfpId,
    title: e.rfps.title,
    description: e.rfps.description,
    deadline: e.rfps.submission_deadline,
    orgName: e.rfps.organisations?.name ?? '',
    status: vendorFacingStatus(e.status),
    open: !submitted && reason === null,
    closedReason: reason,
    submission: sub ? { id: sub.id, status: sub.status, submittedAt: sub.submitted_at } : null,
    documents: (sub?.documents ?? [])
      .map((d) => ({ id: d.id, fileName: d.file_name, fileType: d.file_type, sizeBytes: d.file_size_bytes, uploadedAt: d.created_at }))
      .sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt)),
    orgId: e.org_id,
    vendorAccountId: e.vendor_account_id,
    entryId: e.id,
  }
}

/** Explicit whitelist of what reaches the vendor's browser (internal ids stay server-side). */
export function toClientRfp(r: VendorRfp) {
  return {
    rfpId: r.rfpId,
    title: r.title,
    description: r.description,
    deadline: r.deadline,
    orgName: r.orgName,
    status: r.status,
    open: r.open,
    closedReason: r.closedReason,
    submission: r.submission,
    documents: r.documents,
  }
}
export type ClientVendorRfp = ReturnType<typeof toClientRfp>
