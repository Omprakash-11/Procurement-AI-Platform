'use client'

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { format, isPast } from 'date-fns'
import { Calendar, ClipboardList, Users } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Skeleton } from '@/components/ui/skeleton'
import type { PendingRequirement, PipelineRfp } from '@/lib/queries/rfps'
import { isDraggableStage, RFP_STAGES, RFP_STATUS_LABEL, type RfpStatus } from '@/lib/status'
import { cn } from '@/lib/utils'

type KanbanBoardProps = {
  rfps: PipelineRfp[]
  requirements: PendingRequirement[]
  isLoading: boolean
  onMove: (id: string, status: RfpStatus) => void
}

// A drop is followed by a click on the card; ignore clicks right after a drag.
const dragState = { endedAt: 0 }

// Content Guidelines §7 / Tech Stack §8.2: DndContext at board level, a SortableContext per
// column, each RFP card useSortable. Decision P5-1 on which drops are allowed.
// Keyboard: Space picks up / drops, arrows move, Escape cancels; Enter opens the card.
export function KanbanBoard({ rfps, requirements, isLoading, onMove }: KanbanBoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), // a click still opens the card
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    })
  )

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    dragState.endedAt = Date.now()
    if (!over) return
    const card = rfps.find((r) => r.id === active.id)
    const target = (over.data.current?.columnId ?? rfps.find((r) => r.id === over.id)?.status) as RfpStatus | undefined
    if (!card || !target || target === card.status) return
    if (!isDraggableStage(card.status)) {
      toast.error(`RFPs in ${RFP_STATUS_LABEL[card.status]} can't be moved by hand.`, { duration: 6000 })
      return
    }
    if (!isDraggableStage(target)) {
      toast.error(
        target === 'archived'
          ? 'Use "Archive RFP" on the RFP page to archive it.'
          : `${RFP_STATUS_LABEL[target]} is set by the approval workflow, not by dragging.`,
        { duration: 6000 }
      )
      return
    }
    onMove(card.id, target)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto rounded bg-muted/30 p-4 pb-4" role="region" aria-label="Pipeline board">
        {RFP_STAGES.map(({ status, label }) => {
          const cards = rfps.filter((r) => r.status === status)
          const extra = status === 'requirements_received' ? requirements.length : 0
          return (
            <Column key={status} status={status} label={label} count={cards.length + extra} locked={!isDraggableStage(status)}>
              {isLoading ? (
                <>
                  <Skeleton className="h-24 rounded motion-safe:animate-pulse" />
                  <Skeleton className="h-24 rounded motion-safe:animate-pulse" />
                </>
              ) : (
                <>
                  {status === 'requirements_received' && requirements.map((r) => <RequirementCard key={r.id} requirement={r} />)}
                  <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                    {cards.map((card) => (
                      <RfpCard key={card.id} rfp={card} />
                    ))}
                  </SortableContext>
                </>
              )}
            </Column>
          )
        })}
      </div>
    </DndContext>
  )
}

function Column({ status, label, count, locked, children }: { status: RfpStatus; label: string; count: number; locked: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${status}`, data: { columnId: status } })
  return (
    <section
      ref={setNodeRef}
      aria-label={`${label}, ${count} ${count === 1 ? 'item' : 'items'}`}
      data-testid={`column-${status}`}
      data-locked={locked || undefined}
      className={cn('flex min-w-[280px] flex-col gap-2 rounded bg-muted/50 p-3', isOver && !locked && 'ring-2 ring-primary/40')}
    >
      <header className="mb-2 flex items-center justify-between">
        {/* P4-3: uppercase is the spec'd exception for kanban column titles (§7.2) */}
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</h2>
        <span className="rounded-full bg-border px-2 py-0.5 text-xs font-medium text-foreground" data-testid={`count-${status}`}>
          {count}
        </span>
      </header>
      <div className="flex min-h-[120px] flex-col gap-2">{children}</div>
    </section>
  )
}

function DeadlineBadge({ deadline }: { deadline: string | null }) {
  if (!deadline) return null
  const past = isPast(new Date(deadline))
  return (
    <span className={cn('flex items-center gap-1', past && 'text-destructive')}>
      <Calendar className="size-3" aria-hidden="true" />
      {format(new Date(deadline), 'd MMM yyyy')}
      {past && <span className="sr-only">(past deadline)</span>}
    </span>
  )
}

function RfpCard({ rfp }: { rfp: PipelineRfp }) {
  const router = useRouter()
  const draggable = isDraggableStage(rfp.status)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: rfp.id,
    data: { columnId: rfp.status },
    disabled: !draggable,
  })

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (Date.now() - dragState.endedAt > 250) router.push(`/pipeline/rfp/${rfp.id}`)
      }}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e)
        if (e.key === 'Enter' && !isDragging) router.push(`/pipeline/rfp/${rfp.id}`)
      }}
      aria-roledescription={draggable ? 'Draggable RFP card' : 'RFP card'}
      aria-label={`${rfp.title}, ${RFP_STATUS_LABEL[rfp.status]}`}
      data-testid={`rfp-card-${rfp.id}`}
      className={cn(
        'cursor-pointer rounded border border-border bg-card p-4 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'motion-safe:transition-all motion-safe:duration-150 hover:border-primary/30 hover:shadow-md',
        isDragging && 'rotate-1 scale-[1.02] opacity-50 shadow-lg'
      )}
    >
      <h3 className="text-sm font-medium text-foreground">{rfp.title}</h3>
      <span className="mt-1 inline-block rounded-sm bg-accent px-2 py-0.5 text-xs text-accent-foreground">{rfp.department}</span>
      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
        <DeadlineBadge deadline={rfp.submission_deadline} />
        <span className="flex items-center gap-1">
          <Users className="size-3" aria-hidden="true" />
          {rfp.vendor_count}
          <span className="sr-only">{rfp.vendor_count === 1 ? 'vendor' : 'vendors'}</span>
        </span>
      </div>
    </article>
  )
}

// Decision P5-2: a submitted requirement waiting for an RFP. Not draggable.
function RequirementCard({ requirement }: { requirement: PendingRequirement }) {
  return (
    <Link
      href={`/requirements/${requirement.id}`}
      data-testid={`requirement-card-${requirement.id}`}
      className="rounded border border-dashed border-border bg-card p-4 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:transition-shadow motion-safe:duration-150 hover:shadow-md"
    >
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <ClipboardList className="size-3" aria-hidden="true" />
        Requirement
      </span>
      <h3 className="mt-1 text-sm font-medium text-foreground">{requirement.title}</h3>
      <span className="mt-1 inline-block rounded-sm bg-accent px-2 py-0.5 text-xs text-accent-foreground">{requirement.department}</span>
      {requirement.required_by && (
        <div className="mt-3 text-xs text-muted-foreground">
          <DeadlineBadge deadline={requirement.required_by} />
        </div>
      )}
    </Link>
  )
}
