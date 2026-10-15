import type { Page } from '@playwright/test'

import { expect, test } from './fixtures/auth'
import { createReportedRfp, db } from './helpers/db'
import { env, SEED, unique } from './helpers/env'
import { ContractPage } from './pages/ContractPage'
import { DashboardPage } from './pages/DashboardPage'

// Contracts (Plan Phase 11 contracts.spec + Tech Stack §12.2 renewal alert flow).

/** A contract created the real way: PM submits, FA approves (the DB trigger creates it). */
async function approvedContract(pmPage: Page, faPage: Page, title: string): Promise<string> {
  const { rfpId } = await createReportedRfp(title)
  const fa = (await db().from('profiles').select('id').eq('role', 'finance_approver').single()).data!.id
  const submitted = await pmPage.request.post('/api/approvals', { data: { rfpId, vendorAccountId: SEED.vendor1Id, financeApproverId: fa } })
  const { id } = (await submitted.json()) as { id: string }
  const decided = await faPage.request.patch(`/api/approvals/${id}/decide`, { data: { decision: 'approved', comment: 'Approved.' } })
  expect(decided.status()).toBe(200)
  return (await db().from('contracts').select('id').eq('rfp_id', rfpId).single()).data!.id
}

test.describe('Contracts', () => {
  test('contract is listed; alert days edited inline; terminated with a reason', async ({ pmPage, faPage }) => {
    const title = unique('Security guarding')
    const contractId = await approvedContract(pmPage, faPage, title)
    const contracts = new ContractPage(pmPage)
    await contracts.gotoList()
    await expect(contracts.row(title)).toContainText('Active')
    await contracts.filter('Terminated')
    await expect(contracts.row(title)).toHaveCount(0)

    await contracts.gotoDetail(contractId)
    await contracts.setAlertDays('0')
    await expect(contracts.alertDaysError()).toBeVisible()
    await contracts.setAlertDays('45')
    await expect(contracts.alertDays()).toContainText('45 days')
    expect((await db().from('contracts').select('alert_days').eq('id', contractId).single()).data!.alert_days).toBe(45)

    await contracts.openTerminate()
    await contracts.confirmTerminate()
    await expect(contracts.terminateReasonError()).toBeVisible()
    await contracts.confirmTerminate('Vendor ceased trading in our region.')
    await expect(contracts.termination()).toContainText('Vendor ceased trading in our region.')
    await expect(contracts.status()).toHaveText('Terminated')
  })

  test('initiate renewal creates a new RFP and pre-fills the vendor invite', async ({ pmPage, faPage }) => {
    const title = unique('Waste management')
    const contractId = await approvedContract(pmPage, faPage, title)
    const contracts = new ContractPage(pmPage)
    await contracts.gotoDetail(contractId)
    await contracts.initiateRenewal()
    await expect(pmPage).toHaveURL(/\/pipeline\/rfp\/[0-9a-f-]{36}\?inviteEmail=/)
    await expect(pmPage.locator('#invite-vendor-email')).toHaveValue('vendor1@procuremaster.test')
    const { data } = await db().from('rfps').select('id').like('title', `Renewal — ${title}%`)
    expect(data).toHaveLength(1)
  })

  test('renewal cron flags a contract inside its alert window and the dashboard shows it', async ({ pmPage, faPage }) => {
    const title = unique('HVAC maintenance')
    const contractId = await approvedContract(pmPage, faPage, title)
    const end = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10)
    await db().from('contracts').update({ end_date: end, alert_days: 30 }).eq('id', contractId)

    expect((await pmPage.request.get('/api/cron/renewal-alerts')).status()).toBe(401)
    const run = await pmPage.request.get('/api/cron/renewal-alerts', { headers: { Authorization: `Bearer ${env('CRON_SECRET')}` } })
    expect(run.status()).toBe(200)
    expect(((await run.json()) as { flagged: number }).flagged).toBeGreaterThanOrEqual(1)
    expect((await db().from('contracts').select('status').eq('id', contractId).single()).data!.status).toBe('expiring_soon')

    const dashboard = new DashboardPage(pmPage)
    await dashboard.goto()
    await expect(dashboard.renewalTable()).toContainText(title)
    await dashboard.openNotification(/Contract expiring in \d+ days/)
    await expect(pmPage).toHaveURL(/\/contracts\/[0-9a-f-]{36}$/)
  })
})
