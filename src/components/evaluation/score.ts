import type { StatusTone } from '@/components/ui/status-badge'

// App Flow §4 Tab 2 / Content Guidelines §9.1 thresholds: green ≥ 7, amber 4–6.9, red < 4.
export const scoreTone = (score: number): StatusTone => (score >= 7 ? 'success' : score >= 4 ? 'warning' : 'danger')
