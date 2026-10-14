import { AvatarMenu } from '@/components/layout/avatar-menu'
import { GlobalSearch } from '@/components/layout/global-search'
import { NotificationBell } from '@/components/layout/notification-bell'
import type { ShellUser } from '@/lib/auth/current-user'

// Content Guidelines §5.3 / App Flow §2.2: search centred, bell + avatar right.
// The logo lives in the sidebar's 56px logo area, which sits beside this bar and links home.
export function TopBar({ user }: { user: ShellUser }) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-4 border-b border-border bg-background px-8">
      <div aria-hidden="true" className="w-9" />
      <GlobalSearch />
      <div className="flex items-center gap-3">
        <NotificationBell />
        <AvatarMenu name={user.fullName} email={user.email} avatarUrl={user.avatarUrl} />
      </div>
    </header>
  )
}
