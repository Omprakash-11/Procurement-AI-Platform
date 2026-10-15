import type { Metadata } from 'next'

import { ScoringTemplates } from '@/components/settings/scoring-templates'
import { SettingsFrame } from '@/components/settings/settings-frame'

export const metadata: Metadata = { title: 'Scoring templates — ProcureMaster' }

// Decision P4-8: scoring templates, built in Phase 7 alongside the evaluation criteria modal.
export default function ScoringTemplatesPage() {
  return (
    <SettingsFrame current="scoring-templates">
      <ScoringTemplates />
    </SettingsFrame>
  )
}
