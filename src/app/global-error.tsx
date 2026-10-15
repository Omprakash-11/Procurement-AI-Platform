'use client'

import './globals.css'

import { ErrorState } from '@/components/feedback/error-states'

// App Flow §10.1 "/500" when even the root layout fails: renders its own <html>.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans text-foreground">
        <ErrorState reset={reset} digest={error.digest} />
      </body>
    </html>
  )
}
