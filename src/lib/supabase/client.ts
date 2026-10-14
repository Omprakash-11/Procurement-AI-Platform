import { createBrowserClient } from '@supabase/ssr'

import type { Database } from '@/types/database'

// Tech Stack §4.1 — for Client Components. Uses the public anon key only; RLS applies.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
