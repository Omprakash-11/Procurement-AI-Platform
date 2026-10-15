'use client'

import { useEffect } from 'react'

import { ErrorState } from '@/components/feedback/error-states'

// App Flow §10.1 "/500": unhandled error in this segment — message, Retry, contact support.
export default function SegmentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])
  return <ErrorState reset={reset} digest={error.digest} />
}
