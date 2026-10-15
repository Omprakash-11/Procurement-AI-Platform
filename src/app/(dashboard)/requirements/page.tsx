import { Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { PageContainer, PageHeader } from '@/components/layout/page-header'
import { RequirementsTable, type RequirementRow } from '@/components/requirements/requirements-table'
import { Button } from '@/components/ui/button'
import { getShellUser } from '@/lib/auth/current-user'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Requirements — ProcureMaster' }

// App Flow §5 Requirements List. DH: their own (RLS requirements_dh_read) + "New Requirement";
// PM: every requirement in the org (read).
export default async function RequirementsPage() {
  const user = await getShellUser()
  const supabase = await createClient()
  const { data } = await supabase
    .from('requirements')
    .select('id, title, department, priority, status, created_at, profiles!requirements_raised_by_fkey(full_name)')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
  const rows: RequirementRow[] = (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    department: r.department,
    priority: r.priority,
    status: r.status,
    createdAt: r.created_at,
    raisedBy: r.profiles?.full_name ?? '—',
  }))
  const isDh = user?.role === 'department_head'

  return (
    <PageContainer>
      <PageHeader
        title="Requirements"
        description={isDh ? 'Procurement requests you have raised.' : 'Procurement requirements raised by department heads.'}
        action={
          isDh ? (
            <Button asChild>
              <Link href="/requirements/new">
                <Plus aria-hidden="true" />
                New Requirement
              </Link>
            </Button>
          ) : undefined
        }
      />
      <RequirementsTable rows={rows} showRaisedBy={!isDh} />
    </PageContainer>
  )
}
