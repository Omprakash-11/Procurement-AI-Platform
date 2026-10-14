'use client'

import { Search } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { useAppStore } from '@/stores/useAppStore'

const CATEGORIES = ['RFPs', 'Vendors', 'Contracts'] as const

// App Flow §8.1 / Content Guidelines §5.3 — UI shell only in Phase 4 (search API comes later).
// Typing opens the overlay after a 300 ms debounce; categories render empty for now.
export function GlobalSearch() {
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

  const showOverlay = open && debounced.length > 0

  return (
    <div ref={containerRef} className="relative w-80">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input
        type="search"
        role="combobox"
        aria-expanded={showOverlay}
        aria-controls="global-search-results"
        aria-label="Search RFPs, vendors, contracts"
        placeholder="Search RFPs, vendors, contracts…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        className="h-9 w-full rounded border border-input bg-muted pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {showOverlay && (
        <div
          id="global-search-results"
          role="listbox"
          aria-label="Search results"
          className="absolute left-0 top-full z-50 mt-1 w-full rounded border border-border bg-popover p-2 text-popover-foreground shadow-lg"
        >
          {CATEGORIES.map((category) => (
            <div key={category} className="px-2 py-1.5">
              <p className="text-xs font-medium text-muted-foreground">{category}</p>
            </div>
          ))}
          <Link
            href={`/search?q=${encodeURIComponent(debounced)}`}
            onClick={() => setOpen(false)}
            className="mt-1 block rounded border-t border-border px-2 pb-1 pt-2 text-sm font-medium text-primary hover:underline"
          >
            See all results for &ldquo;{debounced}&rdquo;
          </Link>
        </div>
      )}
    </div>
  )
}
