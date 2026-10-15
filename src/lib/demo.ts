import accounts from '../../scripts/demo/accounts.json'

import { apiError } from '@/lib/api'

// Decision P12-2: DEMO_MODE=1 turns a deployment into a shared demonstration — everything works,
// except actions that would let one visitor lock out or disturb the others, and outgoing email.

export const isDemoMode = () => process.env.DEMO_MODE === '1'

/** { error, code } answer for an action that is switched off in the demonstration. */
export function demoRestricted(action: string) {
  return apiError(403, 'demo_restricted', `${action} is turned off in this demonstration.`)
}

export type DemoLogin = { label: string; email: string }

/** Logins listed on the sign-in page in demo mode (shared password from the seed file). */
export const DEMO_LOGINS: { password: string; logins: DemoLogin[] } = {
  password: accounts.password,
  logins: [...accounts.internal.map((a) => ({ label: a.label, email: a.email })), ...accounts.vendors.map((v) => ({ label: v.label, email: v.email }))],
}
