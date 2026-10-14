import { NextResponse } from 'next/server'

import { apiError, validationError } from '@/lib/api'
import { createSubmissionSchema } from '@/lib/schemas/vendor-portal'
import { createAdminClient } from '@/lib/supabase/server'
import { getVendorRfp, listVendorRfps, requireVendor } from '@/lib/vendor/portal'

// GET /api/submissions — Plan Phase 6 (vendor): the vendor's RFPs and submission states.
// Whitelisted fields only (P2-4).
export async function GET() {
  const auth = await requireVendor()
  if (!auth.ok) return auth.response
  const rfps = await listVendorRfps(auth.userId)
  return NextResponse.json({
    rfps: rfps.map((r) => ({
      rfpId: r.rfpId,
      title: r.title,
      orgName: r.orgName,
      deadline: r.deadline,
      status: r.status,
      open: r.open,
      submission: r.submission,
    })),
  })
}

// POST /api/submissions — Plan Phase 6 (vendor): get or create the vendor's in-progress
// submission for an RFP they were invited to (one per vendor per RFP — Schema §2.8).
export async function POST(request: Request) {
  const auth = await requireVendor()
  if (!auth.ok) return auth.response
  const parsed = createSubmissionSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return validationError(parsed.error)

  const rfp = await getVendorRfp(auth.userId, parsed.data.rfpId)
  if (!rfp) return apiError(404, 'not_found', 'RFP not found.')
  if (rfp.submission) return NextResponse.json({ submissionId: rfp.submission.id })
  if (!rfp.open) return apiError(409, 'closed', rfp.closedReason ?? 'This RFP is no longer accepting proposals.')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('submissions')
    .insert({ org_id: rfp.orgId, rfp_id: rfp.rfpId, vendor_account_id: rfp.vendorAccountId, rfp_vendor_entry_id: rfp.entryId })
    .select('id')
    .single()
  if (error?.code === '23505') {
    const { data: existing } = await admin.from('submissions').select('id').eq('rfp_id', rfp.rfpId).eq('vendor_account_id', rfp.vendorAccountId).single()
    return NextResponse.json({ submissionId: existing?.id })
  }
  if (error || !data) return apiError(500, 'create_failed', 'We could not start your submission. Please try again.')
  return NextResponse.json({ submissionId: data.id }, { status: 201 })
}
