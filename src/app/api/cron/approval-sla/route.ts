import { NextResponse } from 'next/server'

import ApprovalSlaReminderEmail from '@/emails/approval-sla-reminder'
import { logActivity } from '@/lib/activity'
import { formatSla } from '@/lib/approval-workflow'
import { appUrl, withErrors } from '@/lib/api'
import { cronUnauthorized } from '@/lib/cron'
import { sendEmail } from '@/lib/email/send'
import { notify } from '@/lib/processing/notify'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const REMINDED = 'approval.sla_reminder_sent'

// Backend Schema §8.8 / Tech Stack §11.2 (daily 09:00 UTC): pending approvals due within 24 h
// (or already overdue) → the assigned FA gets an in-app warning + reminder email. P9-1: once
// per approval, recorded in the activity log.
async function run(request: Request) {
  const denied = cronUnauthorized(request)
  if (denied) return denied

  const admin = createAdminClient()
  const soon = new Date(Date.now() + 24 * 3_600_000).toISOString()
  const { data: due, error } = await admin
    .from('approval_requests')
    .select('id, org_id, rfp_id, vendor_account_id, submitted_to, sla_due_at, rfps(title), vendor_accounts(company_name)')
    .eq('status', 'pending')
    .lt('sla_due_at', soon)
  if (error) return NextResponse.json({ error: 'SLA check failed.', code: 'query_failed' }, { status: 500 })

  let reminded = 0
  for (const a of due ?? []) {
    const { count } = await admin.from('activity_log').select('id', { count: 'exact', head: true }).eq('action', REMINDED).eq('entity_id', a.id)
    if ((count ?? 0) > 0) continue

    const overdue = new Date(a.sla_due_at).getTime() <= Date.now()
    const rfpTitle = a.rfps?.title ?? 'RFP'
    const vendorName = a.vendor_accounts?.company_name ?? 'Vendor'
    await notify({
      orgId: a.org_id,
      recipientId: a.submitted_to,
      type: 'approval_sla_warning',
      title: overdue ? 'Approval overdue' : 'Approval due within 24 hours',
      body: `${vendorName} for "${rfpTitle}"`,
      entityType: 'approval_request',
      entityId: a.id,
    })
    const { data: fa } = await admin.auth.admin.getUserById(a.submitted_to)
    if (fa.user?.email) {
      try {
        await sendEmail({
          to: fa.user.email,
          subject: overdue ? 'An approval is overdue' : 'An approval is due within 24 hours',
          react: ApprovalSlaReminderEmail({ rfpTitle, vendorName, slaDue: formatSla(a.sla_due_at), overdue, approvalUrl: appUrl(`/approvals/${a.id}`) }),
        })
      } catch (err) {
        console.error('approval-sla: email failed', a.id, err)
      }
    }
    await logActivity({
      orgId: a.org_id,
      actorId: null,
      actorType: 'system',
      entityType: 'approval_request',
      entityId: a.id,
      action: REMINDED,
      description: `SLA reminder sent for ${vendorName} on "${rfpTitle}"`,
      after: { sla_due_at: a.sla_due_at, overdue },
      metadata: { rfp_id: a.rfp_id, vendor_account_id: a.vendor_account_id },
    })
    reminded += 1
  }
  return NextResponse.json({ checked: due?.length ?? 0, reminded })
}

export const GET = withErrors(run)
export const POST = withErrors(run)
