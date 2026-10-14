import type { ReactNode } from 'react'

// Public, shell-less screens (auth pages and vendor invite pages — App Flow §2.1): spacious
// centred column with the brand mark.
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center bg-muted/40 px-8 py-16">
      <div className="mb-10 flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded bg-gradient-to-br from-blue-700 to-violet-700 font-heading text-sm text-primary-foreground">
          PM
        </span>
        <span className="font-heading text-xl text-foreground">ProcureMaster</span>
      </div>
      <div className="w-full max-w-lg">{children}</div>
    </main>
  )
}
