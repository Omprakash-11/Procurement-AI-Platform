import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { Fragment } from 'react'

export type Crumb = { label: string; href?: string }

const MAX_LEVELS = 4

// App Flow §2.5 / Content Guidelines §5.4. Renders only for pages two or more levels deep
// (2+ items). Ancestors are links; the current page is plain text. Over 4 levels, the
// middle collapses to an ellipsis.
export function Breadcrumb({ items }: { items: Crumb[] }) {
  if (items.length < 2) return null

  const visible: (Crumb | 'ellipsis')[] =
    items.length > MAX_LEVELS ? [items[0]!, 'ellipsis', ...items.slice(-(MAX_LEVELS - 2))] : items

  return (
    <nav aria-label="Breadcrumb" className="flex h-10 items-center border-b border-border bg-muted/40 px-8">
      <ol className="flex min-w-0 items-center gap-1.5">
        {visible.map((item, index) => {
          const isLast = index === visible.length - 1
          return (
            <Fragment key={item === 'ellipsis' ? 'ellipsis' : `${item.label}-${index}`}>
              {index > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
              <li className="min-w-0">
                {item === 'ellipsis' ? (
                  <span className="text-sm text-muted-foreground" aria-label="More levels">
                    …
                  </span>
                ) : isLast || !item.href ? (
                  <span className="block truncate text-sm font-medium text-foreground" aria-current={isLast ? 'page' : undefined}>
                    {item.label}
                  </span>
                ) : (
                  <Link href={item.href} className="block truncate text-sm text-muted-foreground hover:text-foreground">
                    {item.label}
                  </Link>
                )}
              </li>
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
