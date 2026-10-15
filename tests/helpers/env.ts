import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Reads .env.local (the same local Supabase the app uses). Tests never print these values.
let cache: Record<string, string> | null = null

export function env(name: string): string {
  if (!cache) {
    cache = {}
    const text = readFileSync(join(process.cwd(), '.env.local'), 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
      if (m) cache[m[1]!] = m[2]!.trim().replace(/^["']|["']$/g, '')
    }
  }
  const value = process.env[name] ?? cache[name]
  if (!value) throw new Error(`${name} is not set in .env.local`)
  return value
}

export const PASSWORD = 'Password123!'

/** Seed users (supabase/seed.sql). */
export const USERS = {
  pm: 'pm@procuremaster.test',
  dh: 'dh@procuremaster.test',
  fa: 'fa@procuremaster.test',
  vendor1: 'vendor1@procuremaster.test',
  vendor2: 'vendor2@procuremaster.test',
} as const
export type Role = keyof typeof USERS

export const SEED = {
  rfpId: 'd0000000-0000-4000-8000-000000000001',
  vendor1Id: 'b0000000-0000-4000-8000-000000000011',
  vendor2Id: 'b0000000-0000-4000-8000-000000000012',
} as const

/** Unique suffix so every spec creates its own, non-colliding data (decision P11-2). */
export const unique = (label: string) => `${label} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
