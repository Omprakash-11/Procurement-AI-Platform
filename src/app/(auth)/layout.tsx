import type { ReactNode } from 'react'

import { AuthFrame } from '@/components/layout/auth-frame'

// Public auth screens: no sidebar or top bar (App Flow §2.1).
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AuthFrame>{children}</AuthFrame>
}
