'use client'

import { AlertCircle, RotateCw } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'

// App Flow §10.1 global error pages, shared by not-found.tsx and the error.tsx boundaries.

export function NotFoundState({ homeHref = '/dashboard', homeLabel = 'Back to Dashboard' }: { homeHref?: string; homeLabel?: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center" data-testid="not-found">
      <p className="font-heading text-5xl text-foreground">404</p>
      <h1 className="mt-4 text-xl font-semibold text-foreground">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">The page you&apos;re looking for doesn&apos;t exist, or the item was removed.</p>
      <Button asChild className="mt-6">
        <Link href={homeHref}>{homeLabel}</Link>
      </Button>
    </div>
  )
}

export function ErrorState({ reset, digest }: { reset: () => void; digest?: string | undefined }) {
  const support = process.env.NEXT_PUBLIC_SUPPORT_EMAIL
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center" role="alert" data-testid="error-state">
      <AlertCircle className="size-10 text-destructive" aria-hidden="true" />
      <h1 className="mt-4 text-xl font-semibold text-foreground">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted-foreground">An unexpected error stopped this page from loading. Try again — if it keeps happening, contact support.</p>
      {digest && <p className="mt-2 font-mono text-xs text-muted-foreground">Reference: {digest}</p>}
      <div className="mt-6 flex items-center gap-3">
        <Button onClick={reset}>
          <RotateCw aria-hidden="true" />
          Retry
        </Button>
        {support && (
          <Button variant="outline" asChild>
            <a href={`mailto:${support}?subject=${encodeURIComponent(`ProcureMaster error${digest ? ` ${digest}` : ''}`)}`}>Contact support</a>
          </Button>
        )}
      </div>
    </div>
  )
}
