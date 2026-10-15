'use client'

import { useEffect, useState } from 'react'

/**
 * False during SSR / streaming, true once React has attached event handlers. Controls that
 * would silently drop input before hydration (file pickers, submit buttons — #57, Phase 10)
 * stay disabled until then.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  return hydrated
}
