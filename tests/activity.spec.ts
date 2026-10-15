import { expect, test } from './fixtures/auth'
import { createRfp } from './helpers/db'
import { unique } from './helpers/env'
import { ActivityPage } from './pages/ActivityPage'
import { RFPDetailPage } from './pages/RFPDetailPage'

// Activity log (Plan Phase 11 activity.spec): entries after key actions, per-RFP scoping,
// before / after details, DH scope (P9-2).

test.describe('Activity log', () => {
  test('key actions appear in the feed with before / after details and filters', async ({ pmPage }) => {
    const rfpId = await createRfp(unique('Fleet leasing'))
    const detail = new RFPDetailPage(pmPage)
    await detail.goto(rfpId)
    const renamed = unique('Fleet leasing 2027')
    const res = await pmPage.request.patch(`/api/rfps/${rfpId}`, { data: { title: renamed } })
    expect(res.status()).toBe(200)

    const activity = new ActivityPage(pmPage)
    await activity.goto()
    await expect(activity.entry(`"${renamed}" edited`)).toBeVisible()
    await activity.expandChanges(`"${renamed}" edited`)
    await expect(activity.changes()).toContainText(renamed)

    await activity.filterType('Contracts')
    await expect(activity.entry(`"${renamed}" edited`)).toHaveCount(0)
    await activity.filterType('RFPs')
    await expect(activity.entry(`"${renamed}" edited`)).toBeVisible()
    await activity.filterFrom('2099-01-01')
    await expect(activity.empty()).toBeVisible()
  })

  test('the RFP Activity tab is scoped to that RFP', async ({ pmPage }) => {
    const mine = await createRfp(unique('Canteen services'))
    const other = unique('Unrelated tender')
    const otherId = await createRfp(other)
    await pmPage.request.patch(`/api/rfps/${otherId}`, { data: { title: `${other} v2` } })
    const ownTitle = unique('Canteen services v2')
    await pmPage.request.patch(`/api/rfps/${mine}`, { data: { title: ownTitle } })

    const detail = new RFPDetailPage(pmPage)
    await detail.goto(mine)
    await detail.openActivityTab()
    await expect(detail.activityList().getByText(`"${ownTitle}" edited`)).toBeVisible()
    await expect(detail.activityList().getByText(`"${other} v2" edited`)).toHaveCount(0)
  })

  test('a department head only sees activity about their own work', async ({ pmPage, dhPage }) => {
    const title = unique('Confidential restructuring advisory')
    const rfpId = await createRfp(title)
    await pmPage.request.patch(`/api/rfps/${rfpId}`, { data: { title: `${title} v2` } })
    const activity = new ActivityPage(dhPage)
    await activity.goto()
    await expect(activity.entry(`"${title} v2" edited`)).toHaveCount(0)
  })
})
