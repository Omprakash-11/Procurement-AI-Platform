import { expect, test } from './fixtures/auth'
import { db, orgId, userId } from './helpers/db'
import { MIME, strongProposalPdf } from './helpers/documents'
import { unique, USERS } from './helpers/env'
import { PipelinePage } from './pages/PipelinePage'
import { RequirementsPage } from './pages/RequirementsPage'

// Department Head flow (decision P11-3): raise a requirement with an attachment → it reaches
// the PM's pipeline; a DH never sees requirements raised by others.

test.describe('Requirements', () => {
  test('DH submits a requirement with an attachment; the PM sees it in the pipeline', async ({ browser, dhPage, pmPage }) => {
    const title = unique('Ergonomic chairs for engineering')
    const requirements = new RequirementsPage(dhPage)
    await requirements.gotoNew()
    await requirements.submit()
    await expect(requirements.fieldError('title')).toBeVisible()
    await requirements.fill({ title, description: '45 ergonomic chairs with lumbar support.', department: 'Engineering', budget: '18000', requiredBy: '2027-03-31' })
    await requirements.attach('notes.txt', 'text/plain', Buffer.from('x'))
    await expect(requirements.fileError()).toContainText('Only PDF, DOCX, and XLSX')
    await requirements.attach('Chair-spec.pdf', MIME.pdf, await strongProposalPdf(browser))
    await requirements.submit()
    await expect(dhPage).toHaveURL(/\/requirements$/)
    await expect(requirements.toast('Requirement submitted')).toBeVisible()
    await expect(requirements.row(title)).toContainText('Submitted')

    const { data: req } = await db().from('requirements').select('id, status, requirement_attachments(file_name)').eq('title', title).single()
    expect(req!.requirement_attachments.map((a) => a.file_name)).toEqual(['Chair-spec.pdf'])

    const pipeline = new PipelinePage(pmPage)
    await pipeline.goto()
    await expect(pipeline.requirementCard(req!.id)).toBeVisible()
  })

  test('a DH sees only the requirements they raised', async ({ dhPage }) => {
    const other = unique('Finance team laptops')
    await db().from('requirements').insert({ org_id: await orgId(), raised_by: await userId(USERS.pm), title: other, description: 'x', department: 'Finance', status: 'submitted' })
    const requirements = new RequirementsPage(dhPage)
    await requirements.gotoList()
    await expect(requirements.rows().first()).toBeVisible()
    await expect(requirements.row(other)).toHaveCount(0)
  })
})
