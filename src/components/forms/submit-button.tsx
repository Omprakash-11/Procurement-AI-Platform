'use client'

import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button, type ButtonProps } from '@/components/ui/button'

type SubmitButtonProps = ButtonProps & { pending: boolean; pendingLabel: string }

// Content Guidelines §6.1 loading state: label replaced by a spinning Loader2 + sr-only text.
// Disabled until hydrated (#57): a submit before React attaches its handlers would be a native
// form submission, bypassing validation. (Forms also use method="post", so fields never reach the URL.)
export function SubmitButton({ pending, pendingLabel, children, disabled, ...props }: SubmitButtonProps) {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])

  return (
    <Button type="submit" disabled={!hydrated || pending || disabled} aria-busy={pending || undefined} {...props}>
      {pending ? (
        <>
          <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />
          <span className="sr-only">{pendingLabel}</span>
        </>
      ) : (
        children
      )}
    </Button>
  )
}
