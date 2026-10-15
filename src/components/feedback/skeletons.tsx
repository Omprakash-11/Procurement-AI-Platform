import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// Plan Phase 10: skeleton UI (animate-pulse, suppressed under prefers-reduced-motion) for every
// data-fetching page, shown by the route segments' loading.tsx while server data loads.

const pulse = 'motion-safe:animate-pulse'

function Block({ className }: { className?: string }) {
  return <Skeleton className={cn('rounded bg-muted', pulse, className)} />
}

/** Page title + description placeholder (matches PageHeader spacing). */
export function HeaderSkeleton() {
  return (
    <div className="mb-8 space-y-2 border-b border-border pb-6">
      <Block className="h-8 w-56" />
      <Block className="h-4 w-80" />
    </div>
  )
}

/** Same frame as DataTable: bordered wrapper, muted header, 5 rows. */
export function TableSkeleton({ columns = 5, rows = 5 }: { columns?: number; rows?: number }) {
  return (
    <div className="overflow-hidden rounded border border-border shadow-sm" aria-hidden="true">
      <div className="flex gap-4 border-b border-border bg-muted px-4 py-3">
        {Array.from({ length: columns }, (_, i) => (
          <Block key={i} className="h-3 flex-1 bg-border" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-4 border-b border-border bg-card px-4 py-4 last:border-0">
          {Array.from({ length: columns }, (_, c) => (
            <Block key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Stat cards: label, number block, sparkline strip. */
export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={cn('grid gap-6', count === 3 ? 'grid-cols-3' : 'grid-cols-4')} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-3 rounded border border-border bg-card p-6 shadow-sm">
          <Block className="h-4 w-32" />
          <Block className="h-8 w-16" />
          <Block className="h-12 w-full" />
        </div>
      ))}
    </div>
  )
}

/** Kanban: nine columns with a few skeleton cards each (Content Guidelines §7 sizes). */
export function KanbanSkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden rounded bg-muted/30 p-1 pb-4" aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} className="flex min-w-[280px] flex-col gap-2 rounded bg-muted/50 p-3">
          <Block className="mb-2 h-3 w-28 bg-border" />
          {Array.from({ length: i % 3 === 0 ? 2 : 1 }, (_, j) => (
            <div key={j} className="space-y-2 rounded border border-border bg-card p-3 shadow-md">
              <Block className="h-4 w-3/4" />
              <Block className="h-3 w-1/2" />
              <Block className="h-3 w-1/3" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/** Detail pages: a block of label / value rows. */
export function DetailSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="max-w-2xl space-y-3" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="grid grid-cols-[10rem_1fr] gap-6">
          <Block className="h-4" />
          <Block className="h-4" />
        </div>
      ))}
    </div>
  )
}

/** Screen-reader announcement for every loading state (Phase 10: sr-only text on spinners). */
export function LoadingAnnouncement({ label }: { label: string }) {
  return (
    <p className="sr-only" role="status">
      {label}
    </p>
  )
}

export function PageSkeleton({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-7xl px-8 py-8" data-testid="page-skeleton">
      <LoadingAnnouncement label={label} />
      <HeaderSkeleton />
      {children}
    </div>
  )
}
