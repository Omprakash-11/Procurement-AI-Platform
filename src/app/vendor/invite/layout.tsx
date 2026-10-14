import type { ReactNode } from 'react'

import { AuthFrame } from '@/components/layout/auth-frame'

// App Flow §7: invite pages are public (token-gated) and have no vendor shell.
export default function VendorInviteLayout({ children }: { children: ReactNode }) {
  return <AuthFrame>{children}</AuthFrame>
}
