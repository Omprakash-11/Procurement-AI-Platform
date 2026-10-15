import { DetailSkeleton, PageSkeleton, TableSkeleton } from '@/components/feedback/skeletons'

// Plan Phase 10: skeleton while this page's server data loads (Suspense via loading.tsx).
export default function Loading() {
  return (
    <PageSkeleton label="Loading report">
      <div className="space-y-10">
        <DetailSkeleton rows={4} />
        <TableSkeleton columns={4} />
        <TableSkeleton columns={4} rows={3} />
      </div>
    </PageSkeleton>
  )
}
