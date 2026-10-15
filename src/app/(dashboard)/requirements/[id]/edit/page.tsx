import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { Breadcrumb } from '@/components/layout/breadcrumb'
import { PageContainer, PageHeader } from '@/components/layout/page-header'
import { RequirementForm } from '@/components/requirements/requirement-form'
import { getShellUser } from '@/lib/auth/current-user'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Edit requirement — ProcureMaster' }

type EditPageProps = { params: Promise<{ id: string }> }

// App Flow §5: editing only while Draft or Submitted (before the PM has actioned it). DH only.
export default async function EditRequirementPage({ params }: EditPageProps) {
  const { id } = await params
  const user = await getShellUser()
  const supabase = await createClient()
  const { data: req } = await supabase
    .from('requirements')
    .select('id, title, description, department, budget_estimate, required_by, priority, status, raised_by, linked_rfp_id, requirement_attachments(id, file_name, file_size_bytes, created_at)')
    .eq('id', id)
    .eq('is_deleted', false)
    .maybeSingle()
  if (!req || req.raised_by !== user?.id) notFound()
  if (!['draft', 'submitted'].includes(req.status) || req.linked_rfp_id) redirect(`/requirements/${id}`)

  return (
    <>
      <Breadcrumb items={[{ label: 'Requirements', href: '/requirements' }, { label: req.title, href: `/requirements/${id}` }, { label: 'Edit' }]} />
      <PageContainer>
        <PageHeader title="Edit requirement" />
        <RequirementForm
          mode="edit"
          requirementId={id}
          isDraft={req.status === 'draft'}
          defaults={{
            title: req.title,
            description: req.description,
            department: req.department,
            budgetEstimate: req.budget_estimate ?? '',
            requiredBy: req.required_by ?? '',
            priority: req.priority,
          }}
          attachments={[...req.requirement_attachments]
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .map((a) => ({ id: a.id, fileName: a.file_name, sizeBytes: a.file_size_bytes }))}
        />
      </PageContainer>
    </>
  )
}
