'use client'

import type { ColumnDef } from '@tanstack/react-table'
import Link from 'next/link'

import { DataTable } from '@/components/data-table/data-table'
import type { SearchHit, SearchResults } from '@/lib/search'

const columns = (nameHeader: string, detailHeader: string): ColumnDef<SearchHit, unknown>[] => [
  {
    accessorKey: 'title',
    header: nameHeader,
    cell: ({ row }) => (
      <Link href={row.original.href} className="font-medium text-foreground hover:underline">
        {row.original.title}
      </Link>
    ),
  },
  { accessorKey: 'subtitle', header: detailHeader },
]

// App Flow §8.1 /search results; §10.3: an empty results area has no rows and no messaging.
export function SearchResultsView({ results, showContracts }: { results: SearchResults; showContracts: boolean }) {
  return (
    <div className="space-y-10">
      <section aria-labelledby="results-rfps" className="space-y-3">
        <h2 id="results-rfps" className="text-xl font-semibold text-foreground">
          RFPs
        </h2>
        <DataTable columns={columns('RFP', 'Department')} data={results.rfps} label="RFP results" />
      </section>
      <section aria-labelledby="results-vendors" className="space-y-3">
        <h2 id="results-vendors" className="text-xl font-semibold text-foreground">
          Vendors
        </h2>
        <DataTable columns={columns('Vendor', 'Contact')} data={results.vendors} label="Vendor results" />
      </section>
      {showContracts && (
        <section aria-labelledby="results-contracts" className="space-y-3">
          <h2 id="results-contracts" className="text-xl font-semibold text-foreground">
            Contracts
          </h2>
          <DataTable columns={columns('Contract', 'Vendor / end date')} data={results.contracts} label="Contract results" />
        </section>
      )}
    </div>
  )
}
