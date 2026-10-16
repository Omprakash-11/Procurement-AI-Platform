'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { RelativeTime } from '@/components/dates/local-date'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ActivityItem } from '@/lib/activity-feed'
import { fetchJson } from '@/lib/fetch-json'
import { initials } from '@/lib/roles'
import type { Json } from '@/types'

const GROUPS = [
  ['rfp', 'RFPs'],
  ['vendor', 'Vendors'],
  ['document', 'Documents'],
  ['evaluation', 'Scoring'],
  ['compliance', 'Compliance'],
  ['report', 'Reports'],
  ['approval', 'Approvals'],
  ['contract', 'Contracts'],
  ['requirement', 'Requirements'],
] as const
const ALL = '__all__'

type Page = { items: ActivityItem[]; nextCursor: string | null }
type ActivityFeedProps = {
  /** Scope: one RFP, or one vendor within an RFP, or a contract (served by its own endpoint). */
  scope?: { rfpId: string; vendorAccountId?: string } | { contractId: string }
  filters?: boolean
  label: string
}

/** Changed keys only, for the before/after details (App Flow §8.2, CLAUDE.md before/after JSONB). */
function changes(before: Json | null, after: Json | null): { key: string; from: string; to: string }[] {
  const b = (before && typeof before === 'object' && !Array.isArray(before) ? before : {}) as Record<string, Json>
  const a = (after && typeof after === 'object' && !Array.isArray(after) ? after : {}) as Record<string, Json>
  const show = (v: Json | undefined) => (v === undefined || v === null ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v))
  return [...new Set([...Object.keys(b), ...Object.keys(a)])]
    .filter((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k]))
    .map((k) => ({ key: k.replace(/_/g, ' '), from: show(b[k]), to: show(a[k]) }))
}

// App Flow §8.2 activity entries: avatar, name, action description, entity link, relative time
// (absolute on hover); infinite scroll, 50 at a time; filter by event type and date range.
export function ActivityFeed({ scope, filters = false, label }: ActivityFeedProps) {
  const [group, setGroup] = useState<string>(ALL)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [open, setOpen] = useState<Set<string>>(new Set())
  const sentinel = useRef<HTMLDivElement>(null)

  const params = new URLSearchParams()
  if (scope && 'rfpId' in scope) {
    params.set('rfpId', scope.rfpId)
    if (scope.vendorAccountId) params.set('vendorAccountId', scope.vendorAccountId)
  }
  if (group !== ALL) params.set('type', group)
  if (from) params.set('from', `${from}T00:00:00`)
  if (to) params.set('to', `${to}T23:59:59.999`)
  const base = scope && 'contractId' in scope ? `/api/contracts/${scope.contractId}/activity` : '/api/activity'

  const query = useInfiniteQuery({
    queryKey: ['activity', base, params.toString()],
    queryFn: ({ pageParam }) => {
      const p = new URLSearchParams(params)
      if (pageParam) p.set('cursor', pageParam)
      return fetchJson<Page>(`${base}?${p.toString()}`)
    },
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })

  // Infinite scroll: load the next page when the sentinel scrolls into view.
  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage()
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [query])

  const items = query.data?.pages.flatMap((p) => p.items) ?? []

  return (
    <div className="space-y-4">
      {filters && (
        <div className="flex flex-wrap items-end gap-4" role="group" aria-label="Activity filters">
          <div className="w-52">
            <Label htmlFor="activity-type" className="mb-1.5 block text-sm font-medium">
              Event type
            </Label>
            <Select value={group} onValueChange={setGroup}>
              <SelectTrigger id="activity-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All events</SelectItem>
                {GROUPS.map(([value, text]) => (
                  <SelectItem key={value} value={value}>
                    {text}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="activity-from" className="mb-1.5 block text-sm font-medium">
              From
            </Label>
            <Input id="activity-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="activity-to" className="mb-1.5 block text-sm font-medium">
              To
            </Label>
            <Input id="activity-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </div>
          {(group !== ALL || from || to) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setGroup(ALL)
                setFrom('')
                setTo('')
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      )}

      <ul className="divide-y divide-border rounded border border-border bg-card" aria-label={label} data-testid="activity-list">
        {items.map((a) => {
          const diff = changes(a.before, a.after)
          const expanded = open.has(a.id)
          return (
            <li key={a.id} className="px-4 py-3">
              <div className="flex items-start gap-3">
                <Avatar className="size-8">
                  <AvatarFallback className="bg-primary/10 text-xs text-primary">{a.actorType === 'system' || !a.actorType ? 'S' : initials(a.actorName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="text-foreground">
                    <span className="font-medium">{a.actorName}</span>{' '}
                    {a.href ? (
                      <Link href={a.href} className="hover:underline">
                        {a.description}
                      </Link>
                    ) : (
                      a.description
                    )}
                  </p>
                  {diff.length > 0 && (
                    <button
                      type="button"
                      className="mt-1 inline-flex items-center gap-1 rounded text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-expanded={expanded}
                      onClick={() =>
                        setOpen((prev) => {
                          const next = new Set(prev)
                          if (next.has(a.id)) next.delete(a.id)
                          else next.add(a.id)
                          return next
                        })
                      }
                    >
                      {expanded ? <ChevronDown className="size-3" aria-hidden="true" /> : <ChevronRight className="size-3" aria-hidden="true" />}
                      {diff.length} {diff.length === 1 ? 'change' : 'changes'}
                    </button>
                  )}
                  {expanded && (
                    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs" data-testid="activity-changes">
                      {diff.map((d) => (
                        <div key={d.key} className="contents">
                          <dt className="capitalize text-muted-foreground">{d.key}</dt>
                          <dd className="break-words text-foreground">
                            <span className="text-muted-foreground line-through">{d.from.slice(0, 200)}</span> → {d.to.slice(0, 200)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
                <RelativeTime value={a.createdAt} titlePattern="d MMM yyyy, HH:mm:ss" className="shrink-0 text-xs text-muted-foreground" />
              </div>
            </li>
          )
        })}
        {items.length === 0 && !query.isLoading && <li className="py-12" data-testid="activity-empty" />}
      </ul>
      <div ref={sentinel} aria-hidden="true" />
      {(query.isLoading || query.isFetchingNextPage) && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 text-primary motion-safe:animate-spin" aria-hidden="true" />
          Loading activity…
        </p>
      )}
    </div>
  )
}
