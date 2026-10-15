'use client'

import { useQuery } from '@tanstack/react-query'
import { Building2, FileText, Kanban, Loader2, Search } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { fetchJson } from '@/lib/fetch-json'
import type { SearchHit, SearchResults } from '@/lib/search'
import { useAppStore } from '@/stores/useAppStore'

const CATEGORIES = [
  { key: 'rfps', label: 'RFPs', icon: Kanban },
  { key: 'vendors', label: 'Vendors', icon: Building2 },
  { key: 'contracts', label: 'Contracts', icon: FileText },
] as const

// App Flow §8.1 / Content Guidelines §5.3 global search (decision P10-1): typing opens the
// overlay after a 300 ms debounce; top 5 per category from /api/search (tsvector, RLS-scoped);
// Enter or "See all results" → /search?q=. Escape closes.
export function GlobalSearch() {
  const router = useRouter()
  const query = useAppStore((s) => s.globalSearchQuery)
  const setQuery = useAppStore((s) => s.setGlobalSearchQuery)
  const [debounced, setDebounced] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const results = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => fetchJson<SearchResults>(`/api/search?q=${encodeURIComponent(debounced)}&limit=5`),
    enabled: debounced.length > 0,
    staleTime: 30_000,
  })

  const showOverlay = open && debounced.length > 0
  const total = results.data ? results.data.rfps.length + results.data.vendors.length + results.data.contracts.length : 0
  const close = () => setOpen(false)

  return (
    <div ref={containerRef} className="relative w-80">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input
        type="search"
        aria-label="Search RFPs, vendors, contracts"
        aria-describedby={showOverlay ? 'global-search-status' : undefined}
        placeholder="Search RFPs, vendors, contracts…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') close()
          if (e.key === 'Enter' && query.trim()) {
            close()
            router.push(`/search?q=${encodeURIComponent(query.trim())}`)
          }
        }}
        className="h-9 w-full rounded border border-input bg-muted pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {showOverlay && (
        <div
          id="global-search-results"
          role="region"
          aria-label="Search results"
          onKeyDown={(e) => e.key === 'Escape' && close()}
          className="absolute left-0 top-full z-50 mt-1 w-[28rem] rounded border border-border bg-popover p-2 text-popover-foreground shadow-lg"
        >
          <p id="global-search-status" className="sr-only" role="status">
            {results.isFetching ? 'Searching…' : `${total} results`}
          </p>
          {results.isFetching && !results.data && (
            <p className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
              <Loader2 className="size-4 text-primary motion-safe:animate-spin" aria-hidden="true" />
              Searching…
            </p>
          )}
          {CATEGORIES.map(({ key, label, icon: Icon }) => (
            <div key={key} className="px-2 py-1.5">
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <ul className="mt-1 space-y-0.5" aria-label={label}>
                {(results.data?.[key] ?? []).map((hit: SearchHit) => (
                  <li key={hit.id}>
                    <Link
                      href={hit.href}
                      onClick={close}
                      className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="truncate text-foreground">{hit.title}</span>
                      <span className="ml-auto truncate text-xs text-muted-foreground">{hit.subtitle}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <Link
            href={`/search?q=${encodeURIComponent(debounced)}`}
            onClick={close}
            className="mt-1 block rounded border-t border-border px-2 pb-1 pt-2 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            See all results for &ldquo;{debounced}&rdquo;
          </Link>
        </div>
      )}
    </div>
  )
}
