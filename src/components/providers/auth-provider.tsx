'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, type ReactNode } from 'react'

import { createClient } from '@/lib/supabase/client'

// Supabase session listener (Plan Phase 3). Keeps server-rendered UI in step with auth
// changes made in another tab or by token expiry; clears cached data on sign-out.
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const queryClient = useQueryClient()

  useEffect(() => {
    const supabase = createClient()
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        queryClient.clear()
        router.refresh()
      }
    })
    return () => data.subscription.unsubscribe()
  }, [router, queryClient])

  return <>{children}</>
}
