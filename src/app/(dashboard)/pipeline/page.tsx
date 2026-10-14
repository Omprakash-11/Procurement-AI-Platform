import type { Metadata } from 'next'

import { PageContainer } from '@/components/layout/page-header'
import { PipelineView } from '@/components/pipeline/pipeline-view'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Pipeline — ProcureMaster' }

// App Flow §4 — Pipeline kanban (PM only; middleware enforces the role). The board scrolls
// horizontally inside the standard content width (Content Guidelines §4.1, §7.1).
export default async function PipelinePage() {
  const supabase = await createClient()
  const { data: org } = await supabase.from('organisations').select('currency').maybeSingle()
  return (
    <PageContainer>
      <PipelineView currency={org?.currency ?? 'USD'} />
    </PageContainer>
  )
}
