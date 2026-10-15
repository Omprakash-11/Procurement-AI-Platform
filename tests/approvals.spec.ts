import { expect, test } from './fixtures/auth'
import { createReportedRfp, db } from './helpers/db'
import { SEED, unique, USERS } from './helpers/env'
import { clearMail, waitForMail } from './helpers/mail'
import { ApprovalPage } from './pages/ApprovalPage'
import { ReportPage } from './pages/ReportPage'

// Approval workflow (Tech Stack §12.2): PM submits → FA notified → FA decides → PM notified;
// approval creates the contract and contracts the vendor.

test.describe('Approvals', () => {
  test('PM submits for approval; FA approves; contract created and vendor contracted', async ({ pmPage, faPage }) => {
    test.setTimeout(60_000)
    await clearMail()
    const title = unique('Fleet telematics')
    const { rfpId } = await createReportedRfp(title)

    const report = new ReportPage(pmPage)
    await report.goto(rfpId)
    await report.submitForApproval()
    await expect(report.pendingApproval()).toContainText('Approval pending with')
    const { data: request } = await db().from('approval_requests').select('id, status').eq('rfp_id', rfpId).single()
    expect(request!.status).toBe('pending')
    const mail = await waitForMail(USERS.fa, 'A vendor selection needs your approval')
    expect(mail.html).toContain(`/approvals/${request!.id}`)

    const approvals = new ApprovalPage(faPage)
    await approvals.gotoQueue()
    await expect(approvals.queueRow(title)).toContainText('Pending')
    await approvals.gotoRequest(request!.id)
    await expect(approvals.selectedVendor()).toHaveText('Northwind Supplies')
    await expect(approvals.escalations()).toBeVisible()
    await approvals.approve('Approved within the department budget.')
    await expect(approvals.outcome()).toContainText('Approved')

    const { data: contract } = await db().from('contracts').select('status, vendor_account_id').eq('rfp_id', rfpId).single()
    expect(contract).toMatchObject({ status: 'active', vendor_account_id: SEED.vendor1Id })
    const { data: entries } = await db().from('rfp_vendor_entries').select('vendor_account_id, status').eq('rfp_id', rfpId)
    expect(entries!.find((e) => e.vendor_account_id === SEED.vendor1Id)!.status).toBe('contracted')
    expect(entries!.find((e) => e.vendor_account_id === SEED.vendor2Id)!.status).toBe('not_selected')
    expect((await db().from('rfps').select('status').eq('id', rfpId).single()).data!.status).toBe('contracted')
    await waitForMail(USERS.pm, 'Vendor selection approved')
  })

  test('FA rejection needs a reason; PM is told why and can recall a resubmission', async ({ pmPage, faPage }) => {
    test.setTimeout(60_000)
    const title = unique('Office furniture')
    const { rfpId } = await createReportedRfp(title)
    const report = new ReportPage(pmPage)
    await report.goto(rfpId)
    await report.submitForApproval()
    const { data: first } = await db().from('approval_requests').select('id').eq('rfp_id', rfpId).eq('status', 'pending').single()

    const approvals = new ApprovalPage(faPage)
    await approvals.gotoRequest(first!.id)
    await approvals.openReject()
    await approvals.confirmReject()
    await expect(approvals.fieldError('decision-rejected-comment')).toBeVisible()
    await expect(approvals.fieldError('decision-rejected-reason')).toBeVisible()
    await faPage.keyboard.press('Escape')
    await approvals.reject('Budget concerns', 'Over budget for this quarter.')
    await expect(approvals.outcome()).toContainText('Reason: Budget concerns')
    expect((await db().from('rfps').select('status').eq('id', rfpId).single()).data!.status).toBe('shortlisted')
    const { count } = await db().from('notifications').select('id', { count: 'exact', head: true }).eq('type', 'approval_decided').eq('entity_id', rfpId)
    expect(count).toBe(1)

    await report.goto(rfpId)
    await report.submitForApproval()
    await report.recall()
    await expect(report.submitButton()).toBeVisible()
    const { data: rows } = await db().from('approval_requests').select('status').eq('rfp_id', rfpId).order('created_at')
    expect(rows!.map((r) => r.status)).toEqual(['rejected', 'recalled'])
  })

  test('only one pending approval per RFP', async ({ pmPage }) => {
    const { rfpId } = await createReportedRfp(unique('Catering services'))
    const fa = (await db().from('profiles').select('id').eq('role', 'finance_approver').single()).data!.id
    const body = { rfpId, vendorAccountId: SEED.vendor1Id, financeApproverId: fa }
    expect((await pmPage.request.post('/api/approvals', { data: body })).status()).toBe(201)
    const second = await pmPage.request.post('/api/approvals', { data: body })
    expect(second.status()).toBe(409)
    expect(await second.json()).toMatchObject({ code: expect.any(String), error: expect.any(String) })
  })
})
