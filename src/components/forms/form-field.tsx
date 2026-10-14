import { AlertCircle } from 'lucide-react'
import type { ReactNode } from 'react'

import { Label } from '@/components/ui/label'

type FormFieldProps = {
  id: string
  label: string
  required?: boolean
  error?: string | undefined
  hint?: string
  children: ReactNode
}

// Content Guidelines §6.2: label text-sm font-medium with mb-1.5, red '*' appended to the
// label, helper text-xs muted, inline error text-xs destructive with a 12px AlertCircle.
// Pair the control with fieldA11y(id, error).
export function FormField({ id, label, required, error, hint, children }: FormFieldProps) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="size-3 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  )
}

export function fieldA11y(id: string, error: string | undefined) {
  return {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : undefined,
  } as const
}
