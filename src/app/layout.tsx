import type { Metadata } from 'next'
import { Cal_Sans, Inter, JetBrains_Mono } from 'next/font/google'

import { AuthProvider } from '@/components/providers/auth-provider'
import { QueryProvider } from '@/components/providers/query-provider'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { cn } from '@/lib/utils'

import './globals.css'

// Decision D7 (Option B): Cal Sans from Google Fonts instead of a self-hosted SemiBold woff2.
// Google ships Cal Sans as a single weight (400) — the same face; never bold it further.
const calSans = Cal_Sans({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-heading',
  display: 'swap',
  // next/font has no fallback metrics for Cal Sans; use the same fallbacks as tailwind.config.ts instead.
  adjustFontFallback: false,
  fallback: ['system-ui', 'sans-serif'],
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ProcureMaster',
  description: 'AI procurement intelligence for SMB procurement teams',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={cn(calSans.variable, inter.variable, jetbrainsMono.variable)}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <QueryProvider>
            <AuthProvider>{children}</AuthProvider>
          </QueryProvider>
          {/* Content Guidelines §6.8: top-right, max 3 stacked, close button */}
          <Toaster position="top-right" visibleToasts={3} closeButton />
        </ThemeProvider>
      </body>
    </html>
  )
}
