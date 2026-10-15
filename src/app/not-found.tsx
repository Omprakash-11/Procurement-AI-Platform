import type { Metadata } from 'next'

import { NotFoundState } from '@/components/feedback/error-states'

export const metadata: Metadata = { title: 'Page not found — ProcureMaster' }

// App Flow §10.1 "/404": unknown route. Middleware sends signed-out users to /login and vendors
// to /vendor, so "Back to Dashboard" lands each role on their home.
export default function NotFound() {
  return (
    <main className="min-h-screen bg-background">
      <NotFoundState />
    </main>
  )
}
