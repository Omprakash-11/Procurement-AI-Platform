'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

// App Flow §10.2 — unauthorised page access: redirect to /dashboard with this toast.
export function DeniedToast({ denied }: { denied: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const shown = useRef(false)

  useEffect(() => {
    if (!denied || shown.current) return
    shown.current = true
    // Child effects run before the root <Toaster> subscribes; defer one tick so the toast isn't lost.
    setTimeout(() => toast.error('You do not have permission to access that page.', { duration: 6000 }), 0)
    router.replace(pathname) // drop ?denied=1 so a refresh doesn't repeat the toast
  }, [denied, pathname, router])

  return null
}
