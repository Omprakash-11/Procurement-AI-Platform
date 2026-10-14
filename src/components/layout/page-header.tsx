import type { ReactNode } from 'react'

type PageHeaderProps = { title: string; description?: string | undefined; action?: ReactNode }

// Content Guidelines §5.5: Cal Sans text-3xl title, muted description (max-w-2xl), primary
// action top-right in the same row, then a rule separating header from content.
export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-8 border-b border-border pb-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl text-foreground">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
    </div>
  )
}

/** Standard page container: max-w-7xl, 32px padding (Content Guidelines §4.1). */
export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-7xl px-8 py-8">{children}</div>
}
