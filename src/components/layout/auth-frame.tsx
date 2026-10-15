import { CalendarClock, ListChecks, ShieldAlert, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'

// Public, shell-less screens (auth pages and vendor invite pages — App Flow §2.1). Decision P12-7:
// two panels on wide screens — a flat brand-blue panel (no gradient, Content Guidelines §2.4) with
// factual product highlights, and the form on the right. Narrow screens show the form only.
const HIGHLIGHTS = [
  { icon: Sparkles, text: 'AI reads vendor proposals and pulls out price, terms and service levels' },
  { icon: ShieldAlert, text: 'Risky contract clauses flagged before you sign' },
  { icon: ListChecks, text: 'Weighted vendor scoring and an advisory comparison report' },
  { icon: CalendarClock, text: 'Finance approval and contract renewal tracking in one place' },
]

export function AuthFrame({ children, highlights = true }: { children: ReactNode; highlights?: boolean }) {
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[44%] max-w-[640px] flex-col overflow-y-auto bg-blue-700 px-12 py-10 text-primary-foreground lg:flex" aria-label="About ProcureMaster">
        <Brand inverted />
        <div className="mt-14 max-w-md">
          <p className="font-heading text-3xl leading-tight">Procurement from request to signed contract.</p>
          {highlights && (
            <ul className="mt-6 space-y-3">
              {HIGHLIGHTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3 text-sm text-primary-foreground/90">
                  <Icon className="size-5 shrink-0" aria-hidden="true" />
                  {text}
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="mt-auto pt-8 text-xs text-primary-foreground/70">© {new Date().getFullYear()} ProcureMaster</p>
      </aside>
      <main className="flex flex-1 flex-col items-center bg-muted/40 px-8 py-16 lg:justify-center lg:py-6">
        <div className="mb-10 lg:hidden">
          <Brand />
        </div>
        <div className="w-full max-w-lg">{children}</div>
      </main>
    </div>
  )
}

function Brand({ inverted = false }: { inverted?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {inverted ? (
        <span className="flex size-8 items-center justify-center rounded bg-primary-foreground font-heading text-sm text-blue-700">PM</span>
      ) : (
        <span className="flex size-8 items-center justify-center rounded bg-gradient-to-br from-blue-700 to-violet-700 font-heading text-sm text-primary-foreground">
          PM
        </span>
      )}
      <span className={inverted ? 'font-heading text-xl' : 'font-heading text-xl text-foreground'}>ProcureMaster</span>
    </div>
  )
}
