import { DetailSkeleton, PageSkeleton, TableSkeleton } from '@/components/feedback/skeletons'

// Plan Phase 10: skeleton while this page's server data loads (Suspense via loading.tsx).
export default function Loading() {
  return (
    <PageSkeleton label="Loading approval request">
      <div className="space-y-10">
        <DetailSkeleton rows={3} />
        <TableSkeleton columns={4} />
      </div>
    </PageSkeleton>
  )
}
