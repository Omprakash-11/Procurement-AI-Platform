import type { Enums } from '@/types'

// RFP stages after which the evaluation is frozen (approval routing has begun or it's done).
export const EVALUATION_LOCKED: Enums<'rfp_status'>[] = ['approval_pending', 'contracted', 'archived']
export const evaluationLockedMessage = 'This RFP is past evaluation — its scores can no longer change.'
