import type { Metadata } from 'next'

import { SettingsFrame } from '@/components/settings/settings-frame'

export const metadata: Metadata = { title: 'Scoring templates — ProcureMaster' }

// Placeholder — built in Phase 7 alongside the evaluation criteria modal (decision P4-8).
export default function ScoringTemplatesPage() {
  return (
    <SettingsFrame current="scoring-templates">
      <p className="text-sm text-muted-foreground">Reusable scoring criteria templates.</p>
    </SettingsFrame>
  )
}
