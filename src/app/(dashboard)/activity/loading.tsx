import { PageSkeleton, TableSkeleton } from '@/components/feedback/skeletons'

// Plan Phase 10: skeleton while this page's server data loads (Suspense via loading.tsx).
export default function Loading() {
  return (
    <PageSkeleton label="Loading activity">
      <TableSkeleton columns={3} rows={8} />
    </PageSkeleton>
  )
}
