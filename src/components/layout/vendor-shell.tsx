import Link from 'next/link'
import type { ReactNode } from 'react'

import { AvatarMenu } from '@/components/layout/avatar-menu'

type VendorShellProps = { companyName: string; contactName: string; email: string; children: ReactNode }

// App Flow §7: vendor portal — no sidebar. Top bar: logo (left), company name + avatar
// dropdown with Sign Out only (right).
export function VendorShell({ companyName, contactName, email, children }: VendorShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background px-8">
        <Link href="/vendor" className="flex items-center gap-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex size-8 items-center justify-center rounded bg-gradient-to-br from-blue-700 to-violet-700 font-heading text-sm text-primary-foreground">
            PM
          </span>
          <span className="font-heading text-lg text-foreground">ProcureMaster</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground" data-testid="vendor-company">
            {companyName}
          </span>
          <AvatarMenu name={contactName} email={email} avatarUrl={null} variant="vendor" />
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
