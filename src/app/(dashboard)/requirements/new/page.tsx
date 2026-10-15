import type { Metadata } from 'next'

import { Breadcrumb } from '@/components/layout/breadcrumb'
import { PageContainer, PageHeader } from '@/components/layout/page-header'
import { RequirementForm } from '@/components/requirements/requirement-form'
import { getShellUser } from '@/lib/auth/current-user'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'New requirement — ProcureMaster' }

// App Flow §5 Submit Requirement (DH only — middleware). Department is pre-filled from the DH's
// most recent requirement (profiles have no department — P8/P9 defaults).
export default async function NewRequirementPage() {
  const user = await getShellUser()
  const supabase = await createClient()
  const { data: last } = await supabase
    .from('requirements')
    .select('department')
    .eq('raised_by', user?.id ?? '')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <>
      <Breadcrumb items={[{ label: 'Requirements', href: '/requirements' }, { label: 'New Requirement' }]} />
      <PageContainer>
        <PageHeader title="New requirement" description="Describe what your department needs. The procurement team is notified when you submit." />
        <RequirementForm
          mode="create"
          isDraft
          defaults={{ title: '', description: '', department: last?.department ?? '', budgetEstimate: '', requiredBy: '', priority: 'medium' }}
        />
      </PageContainer>
    </>
  )
}
