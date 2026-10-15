import { DetailSkeleton, PageSkeleton } from '@/components/feedback/skeletons'

// Plan Phase 10: skeleton while this page's server data loads (Suspense via loading.tsx).
export default function Loading() {
  return (
    <PageSkeleton label="Loading account">
      <DetailSkeleton rows={4} />
    </PageSkeleton>
  )
}
