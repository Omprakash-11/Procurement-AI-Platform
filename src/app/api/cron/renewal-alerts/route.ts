import { NextResponse } from 'next/server'

import RenewalAlertEmail from '@/emails/renewal-alert'
import { logActivity } from '@/lib/activity'
import { appUrl } from '@/lib/api'
import { cronUnauthorized } from '@/lib/cron'
import { sendEmail } from '@/lib/email/send'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Backend Schema §8.8 / Tech Stack §11.2 (daily 08:00 UTC): process_contract_renewals() moves
// contracts into Expiring Soon / Expired and creates the PM's in-app alert; it returns the
// contracts it just flagged (migration 0034, P9-1) and each gets one renewal-alert email.
async function run(request: Request) {
  const denied = cronUnauthorized(request)
  if (denied) return denied

  const admin = createAdminClient()
  const { data: flagged, error } = await admin.rpc('process_contract_renewals')
  if (error) {
    console.error('renewal-alerts: rpc failed', error.message)
    return NextResponse.json({ error: 'Renewal processing failed.', code: 'rpc_failed' }, { status: 500 })
  }

  let emailed = 0
  for (const c of flagged ?? []) {
    const { data: contract } = await admin.from('contracts').select('rfp_id, vendor_account_id, vendor_accounts(company_name)').eq('id', c.contract_id).single()
    await logActivity({
      orgId: c.org_id,
      actorId: null,
      actorType: 'system',
      entityType: 'contract',
      entityId: c.contract_id,
      action: 'contract.renewal_alert',
      description: `Renewal alert: "${c.title}" ends on ${c.end_date} (${c.days_remaining} days)`,
      after: { status: 'expiring_soon', days_remaining: c.days_remaining },
      metadata: { contract_id: c.contract_id, rfp_id: contract?.rfp_id ?? null, vendor_account_id: contract?.vendor_account_id ?? null },
    })
    if (!c.pm_id) continue
    const { data: pm } = await admin.auth.admin.getUserById(c.pm_id)
    if (!pm.user?.email) continue
    try {
      await sendEmail({
        to: pm.user.email,
        subject: c.days_remaining > 0 ? `Contract expiring in ${c.days_remaining} days` : 'A contract has reached its end date',
        react: RenewalAlertEmail({
          contractTitle: c.title,
          vendorName: contract?.vendor_accounts?.company_name ?? 'the vendor',
          endDate: c.end_date,
          daysRemaining: c.days_remaining,
          contractUrl: appUrl(`/contracts/${c.contract_id}`),
        }),
      })
      emailed += 1
    } catch (err) {
      console.error('renewal-alerts: email failed', c.contract_id, err)
    }
  }
  return NextResponse.json({ flagged: flagged?.length ?? 0, emailed })
}

export const GET = run
export const POST = run
