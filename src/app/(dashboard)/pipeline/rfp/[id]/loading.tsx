import { DetailSkeleton, PageSkeleton, TableSkeleton } from '@/components/feedback/skeletons'

// Plan Phase 10: skeleton while this page's server data loads (Suspense via loading.tsx).
export default function Loading() {
  return (
    <PageSkeleton label="Loading RFP">
      <div className="grid grid-cols-[minmax(0,35fr)_minmax(0,65fr)] gap-12">
        <DetailSkeleton />
        <TableSkeleton columns={6} />
      </div>
    </PageSkeleton>
  )
}
