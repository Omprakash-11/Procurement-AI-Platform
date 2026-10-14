import Link from 'next/link'
import type { ReactNode } from 'react'

import { Breadcrumb } from '@/components/layout/breadcrumb'
import { PageContainer, PageHeader } from '@/components/layout/page-header'
import { cn } from '@/lib/utils'

const TABS = [
  { key: 'organisation', label: 'Organisation', href: '/settings/organisation' },
  { key: 'scoring-templates', label: 'Scoring templates', href: '/settings/scoring-templates' },
] as const

type SettingsFrameProps = { current: (typeof TABS)[number]['key']; children: ReactNode }

// App Flow §9 settings pages: breadcrumb (2 levels deep), page header, then Content
// Guidelines §6.7-styled tabs that link between the settings pages.
export function SettingsFrame({ current, children }: SettingsFrameProps) {
  const currentTab = TABS.find((t) => t.key === current)!
  return (
    <>
      <Breadcrumb items={[{ label: 'Settings', href: '/settings/organisation' }, { label: currentTab.label }]} />
      <PageContainer>
        <PageHeader title="Settings" description="Organisation-wide settings. Only the Procurement Manager can change these." />
        <nav aria-label="Settings sections" className="mb-6 inline-flex rounded bg-muted p-1">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={tab.key === current ? 'page' : undefined}
              className={cn(
                'rounded-[2px] px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                tab.key === current ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        <div className="space-y-12">{children}</div>
      </PageContainer>
    </>
  )
}
