import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

// Content Guidelines §6.3: soft filled badges, text-xs font-medium tracking-wide, 2px radius,
// py-0.5 px-2, non-interactive. Colours come from the P4-4 status tokens (light + dark).
const statusBadgeVariants = cva('inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium tracking-wide', {
  variants: {
    tone: {
      success: 'bg-status-success text-status-success-foreground',
      warning: 'bg-status-warning text-status-warning-foreground',
      danger: 'bg-status-danger text-status-danger-foreground',
      info: 'bg-status-info text-status-info-foreground',
      neutral: 'bg-status-neutral text-status-neutral-foreground',
      ai: 'bg-status-ai text-status-ai-foreground',
    },
  },
  defaultVariants: { tone: 'neutral' },
})

export type StatusTone = NonNullable<VariantProps<typeof statusBadgeVariants>['tone']>

type StatusBadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof statusBadgeVariants>

export function StatusBadge({ className, tone, ...props }: StatusBadgeProps) {
  return <span className={cn(statusBadgeVariants({ tone }), className)} {...props} />
}
