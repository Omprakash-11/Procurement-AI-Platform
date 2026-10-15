import { Sparkles } from 'lucide-react'

import { cn } from '@/lib/utils'

// Content Guidelines §8 / CLAUDE.md: every piece of AI-generated text is prefixed with the Lucide
// Sparkles icon in violet-500 — immediately before the text, never after. No tint, no border.
export function AiSparkles({ size = 14, className }: { size?: 14 | 16; className?: string }) {
  return <Sparkles aria-hidden="true" className={cn('shrink-0 text-violet-500', size === 16 ? 'size-4' : 'size-3.5', className)} data-ai-marker="" />
}

/** Section heading marker for extracted data: Sparkles + "AI Extracted" (Content Guidelines §8). */
export function AiExtractedLabel() {
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-violet-600">
      <AiSparkles />
      AI Extracted
    </span>
  )
}
