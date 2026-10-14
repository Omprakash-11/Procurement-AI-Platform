'use client'

import { LogOut, Monitor, Moon, Sun, UserRound } from 'lucide-react'
import Link from 'next/link'
import { useTheme } from 'next-themes'

import { UserAvatar } from '@/components/layout/user-avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'

type AvatarMenuProps = {
  name: string
  email: string
  avatarUrl: string | null
  /** Vendor portal: Sign Out only (App Flow §7). */
  variant?: 'internal' | 'vendor'
}

// App Flow §2.4 avatar dropdown (+ decision P4-6 theme switch for internal users).
export function AvatarMenu({ name, email, avatarUrl, variant = 'internal' }: AvatarMenuProps) {
  const { theme, setTheme } = useTheme()

  // A full page load (not router.replace, which the auth listener's refresh cancels) so no
  // signed-in page or cached data survives sign-out.
  const signOut = async () => {
    await createClient().auth.signOut()
    window.location.assign('/login')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label="Account menu"
      >
        <UserAvatar name={name} src={avatarUrl} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded shadow-lg">
        {variant === 'internal' && (
          <>
            <DropdownMenuLabel className="font-normal">
              <p className="truncate text-sm font-medium text-foreground" data-testid="avatar-menu-name">
                {name}
              </p>
              <p className="truncate text-xs text-muted-foreground" data-testid="avatar-menu-email">
                {email}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/account">
                <UserRound className="size-4" aria-hidden="true" />
                My Account
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Monitor className="size-4" aria-hidden="true" />
                Theme
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="rounded">
                <DropdownMenuRadioGroup value={theme ?? 'system'} onValueChange={setTheme}>
                  <DropdownMenuRadioItem value="light">
                    <Sun className="mr-2 size-4" aria-hidden="true" />
                    Light
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark">
                    <Moon className="mr-2 size-4" aria-hidden="true" />
                    Dark
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="system">
                    <Monitor className="mr-2 size-4" aria-hidden="true" />
                    System
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onSelect={signOut}>
          <LogOut className="size-4" aria-hidden="true" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
