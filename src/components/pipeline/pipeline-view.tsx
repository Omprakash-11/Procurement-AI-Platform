'use client'

import { Filter, Plus, Search, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/layout/page-header'
import { KanbanBoard } from '@/components/pipeline/kanban-board'
import { RfpFormDialog } from '@/components/rfps/rfp-form-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreateRfp, useMoveRfp, usePipeline, type PipelineFilters } from '@/lib/queries/rfps'
import { RFP_STAGES } from '@/lib/status'

const ALL = '__all__'

// App Flow §4 Pipeline: "+ New RFP" (modal over the board), filter panel (department,
// status, date range — submission deadline, P5 default) and an inline search that filters
// cards as you type.
export function PipelineView({ currency }: { currency: string }) {
  const router = useRouter()
  const [filters, setFilters] = useState<PipelineFilters>({})
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const { data, isLoading } = usePipeline(filters)
  const move = useMoveRfp(filters)
  const create = useCreateRfp()

  const departments = useMemo(() => {
    const all = [...(data?.rfps ?? []).map((r) => r.department), ...(data?.requirements ?? []).map((r) => r.department)]
    return [...new Set(all)].sort((a, b) => a.localeCompare(b))
  }, [data])

  const term = search.trim().toLowerCase()
  const matches = (title: string, dept: string) => !term || title.toLowerCase().includes(term) || dept.toLowerCase().includes(term)
  const rfps = (data?.rfps ?? []).filter((r) => matches(r.title, r.department))
  const requirements = (data?.requirements ?? []).filter((r) => matches(r.title, r.department))
  const activeFilters = Object.values(filters).filter(Boolean).length

  return (
    <>
      <PageHeader
        title="Pipeline"
        description="Every procurement, by stage. Drag cards between working stages."
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden="true" />
            New RFP
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <div className="relative w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter cards…" aria-label="Filter cards" className="pl-9" />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <Filter aria-hidden="true" />
              Filter{activeFilters > 0 && ` (${activeFilters})`}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 space-y-4 rounded">
            <div className="space-y-1.5">
              <Label htmlFor="filter-department">Department</Label>
              <Select value={filters.department ?? ALL} onValueChange={(v) => setFilters((f) => ({ ...f, department: v === ALL ? '' : v }))}>
                <SelectTrigger id="filter-department">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All departments</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filter-status">Status</Label>
              <Select value={filters.status ?? ALL} onValueChange={(v) => setFilters((f) => ({ ...f, status: v === ALL ? '' : v }))}>
                <SelectTrigger id="filter-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All stages</SelectItem>
                  {RFP_STAGES.map((s) => (
                    <SelectItem key={s.status} value={s.status}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium text-foreground">Submission deadline</legend>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" aria-label="Deadline from" value={filters.from?.slice(0, 10) ?? ''} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
                <Input
                  type="date"
                  aria-label="Deadline to"
                  value={filters.to?.slice(0, 10) ?? ''}
                  onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value ? `${e.target.value}T23:59:59` : '' }))}
                />
              </div>
            </fieldset>
            {activeFilters > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setFilters({})}>
                <X aria-hidden="true" />
                Clear filters
              </Button>
            )}
          </PopoverContent>
        </Popover>
      </div>

      <KanbanBoard
        rfps={rfps}
        requirements={requirements}
        isLoading={isLoading}
        onMove={(id, status) =>
          move.mutate(
            { id, status },
            { onError: (err) => toast.error(err instanceof Error ? err.message : 'We could not move that card.', { duration: 6000 }) }
          )
        }
      />

      <RfpFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        departments={departments}
        currency={currency}
        onSubmit={async (body) => {
          await create.mutateAsync(body)
          setCreateOpen(false)
          toast.success('RFP created successfully', { duration: 4000 })
          router.refresh()
        }}
      />
    </>
  )
}
