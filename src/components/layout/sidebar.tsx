'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { UserAvatar } from '@/components/layout/user-avatar'
import type { ShellUser } from '@/lib/auth/current-user'
import { cn } from '@/lib/utils'

import { NAV_ITEMS, SETTINGS_ITEM, type NavItem } from './nav-items'

// Content Guidelines §5.2 sidebar anatomy. Always visible, never collapses (decision P4-2).
export function Sidebar({ user }: { user: ShellUser }) {
  const pathname = usePathname()
  const items = NAV_ITEMS.filter((item) => item.roles.includes(user.role))
  const showSettings = SETTINGS_ITEM.roles.includes(user.role)

  return (
    <aside className="sticky top-0 flex h-screen flex-col border-r border-border bg-card" aria-label="Main navigation">
      {/* Logo area: 56px, matches the top bar; gradient per Content Guidelines §2.4. Links home (App Flow §2.2). */}
      <Link
        href="/dashboard"
        className="flex h-14 shrink-0 items-center gap-2 bg-gradient-to-br from-blue-700 to-violet-700 px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="flex size-8 items-center justify-center rounded bg-background font-heading text-sm text-primary">PM</span>
        <span className="font-heading text-lg text-primary-foreground">ProcureMaster</span>
      </Link>

      {/* Decision P4-7: the organisation's own logo and name, beneath the brand area. */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3" data-testid="sidebar-org">
        {user.orgLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL; next/image can't cache it
          <img src={user.orgLogoUrl} alt="" className="size-6 rounded-sm object-contain" />
        ) : null}
        <span className="truncate text-sm font-medium text-foreground">{user.orgName}</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => (
          <SidebarLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </nav>

      <div className="space-y-1 border-t border-border px-3 py-3">
        {showSettings && <SidebarLink item={SETTINGS_ITEM} active={pathname.startsWith('/settings')} />}
        <div className="flex items-center gap-3 px-3 py-2">
          <UserAvatar name={user.fullName} src={user.avatarUrl} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{user.fullName}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/')
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        // Content Guidelines §5.2 nav items: 20px icon + label, py-2.5 px-3, gap-2
        'flex items-center gap-2 rounded border-l-2 px-3 py-2.5 text-sm motion-safe:transition-colors motion-safe:duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'border-primary bg-accent font-medium text-primary'
          : 'border-transparent text-muted-foreground hover:bg-accent/60 hover:text-foreground'
      )}
    >
      <Icon className={cn('size-5 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
      {item.label}
    </Link>
  )
}
