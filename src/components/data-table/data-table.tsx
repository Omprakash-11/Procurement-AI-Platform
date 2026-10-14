'use client'

import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'

import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

type DataTableProps<TData> = {
  columns: ColumnDef<TData, unknown>[]
  data: TData[]
  isLoading?: boolean
  /** Accessible table name. */
  label: string
}

// Tech Stack §8.1: TanStack Table rendered into shadcn/ui Table. Content Guidelines §6.5:
// bordered wrapper, muted uppercase header (decision P4-3), bordered rows, no zebra, hover
// tint, py-3 px-4 cells, 5 skeleton rows while loading. App Flow §10.3: an empty table keeps
// its headers and shows no rows or messaging.
export function DataTable<TData>({ columns, data, isLoading, label }: DataTableProps<TData>) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() })

  return (
    <div className="overflow-hidden rounded border border-border shadow-sm">
      <Table aria-label={label}>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="border-b border-border bg-muted hover:bg-muted">
              {group.headers.map((header) => (
                <TableHead key={header.id} className="h-auto px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading
            ? Array.from({ length: 5 }, (_, i) => (
                <TableRow key={`skeleton-${i}`} className="border-b border-border bg-card">
                  {columns.map((_, j) => (
                    <TableCell key={j} className="px-4 py-3">
                      <Skeleton className="h-4 w-full rounded motion-safe:animate-pulse" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : table.getRowModel().rows.length === 0
              ? (
                  // Content Guidelines §6.5 empty state: full-width row, py-12 — no text (App Flow §10.3).
                  <TableRow className="border-b border-border bg-card hover:bg-card" data-testid="empty-row">
                    <TableCell colSpan={columns.length} className="py-12" />
                  </TableRow>
                )
              : table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="min-h-[52px] border-b border-border bg-card motion-safe:transition-colors motion-safe:duration-100 hover:bg-accent/40"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={cn('px-4 py-3 text-sm text-foreground')}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
        </TableBody>
      </Table>
    </div>
  )
}
