import { Loader2 } from 'lucide-react'

import { Button, type ButtonProps } from '@/components/ui/button'

type SubmitButtonProps = ButtonProps & { pending: boolean; pendingLabel: string }

// Content Guidelines §6.1 loading state: label replaced by a spinning Loader2 + sr-only text.
export function SubmitButton({ pending, pendingLabel, children, disabled, ...props }: SubmitButtonProps) {
  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending || undefined} {...props}>
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
