'use client'

import { format, formatDistanceToNow } from 'date-fns'

import { useHydrated } from '@/lib/use-hydrated'

// The server (Vercel, UTC) and the browser (the viewer's time zone) disagree on local dates and
// times, so a date formatted in a client component during SSR doesn't match the browser's render
// (React hydration error #418). Dates shown in the viewer's time zone are therefore formatted only
// once the page has hydrated; until then the <time> element is empty for a moment.

type Props = { value: string; className?: string }

/** A timestamp in the viewer's time zone, e.g. "8 Oct 2026" or "8 Oct 2026, 14:30". */
export function LocalDate({ value, pattern = 'd MMM yyyy', titlePattern, className }: Props & { pattern?: string; titlePattern?: string }) {
  const hydrated = useHydrated()
  const date = new Date(value)
  return (
    <time dateTime={value} className={className} {...(hydrated && titlePattern ? { title: format(date, titlePattern) } : {})}>
      {hydrated ? format(date, pattern) : ''}
    </time>
  )
}

/** "3 days ago", with the full date and time on hover. */
export function RelativeTime({ value, titlePattern = 'd MMM yyyy, HH:mm', className }: Props & { titlePattern?: string }) {
  const hydrated = useHydrated()
  const date = new Date(value)
  return (
    <time dateTime={value} className={className} {...(hydrated ? { title: format(date, titlePattern) } : {})}>
      {hydrated ? formatDistanceToNow(date, { addSuffix: true }) : ''}
    </time>
  )
}

/**
 * The same text on the server and in the browser: UTC wall-clock time formatted with date-fns.
 * (Intl.DateTimeFormat output differs between Node's and the browser's ICU data, e.g. punctuation.)
 */
export function formatUtc(value: string | Date, pattern: string): string {
  const date = new Date(value)
  return format(new Date(date.getTime() + date.getTimezoneOffset() * 60_000), pattern)
}
