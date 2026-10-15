import { format } from 'date-fns'
import type { ReactNode } from 'react'

import { AiSparkles } from '@/components/evaluation/ai-marker'
import { RiskDonut, ScoreBarChart } from '@/components/report/report-charts'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { ReportView as Report } from '@/lib/evaluation'
import { cn } from '@/lib/utils'

const TERMS = [
  ['Price', 'pricing'],
  ['Payment terms', 'paymentTerms'],
  ['Delivery', 'delivery'],
  ['SLA', 'sla'],
] as const

const headCell = 'h-auto px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground'
const bodyCell = 'px-4 py-3 text-sm text-foreground align-top'

function Section({ title, ai, children, label }: { title: string; ai?: boolean; children: ReactNode; label?: string }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="flex items-center gap-1.5 text-xl font-semibold text-foreground">
          {ai && <AiSparkles size={16} />}
          {title}
        </h2>
        {label && <p className="mt-1 text-xs font-medium text-violet-600">{label}</p>}
      </div>
      {children}
    </section>
  )
}

function TableFrame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="overflow-hidden rounded border border-border shadow-sm">
      <Table aria-label={label}>{children}</Table>
    </div>
  )
}

// App Flow §4 Comparison Report — Executive Summary (AI), Vendor Scorecard (chart + criteria ×
// vendors table, total row highlighted), Compliance Risk Summary (table + donut), Key Terms
// Comparison (extracted), AI Recommendation (advisory). Used by the internal report page
// (PM full / DH read-only) and the public share page (P7-6). AI text marked per Content
// Guidelines §8.
export function ReportView({ report, actions }: { report: Report; actions?: ReactNode }) {
  const { evaluation } = report
  const scored = report.vendors.filter((v) => v.total !== null)
  const bars = [...scored].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)).map((v) => ({ name: v.companyName, total: v.total ?? 0, rank: v.rank ?? 0 }))
  const totals = report.vendors.reduce((t, v) => ({ high: t.high + v.flags.high, medium: t.medium + v.flags.medium, low: t.low + v.flags.low }), { high: 0, medium: 0, low: 0 })
  const rec = evaluation.recommendation

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl text-foreground">{report.rfp.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Comparison report · {report.rfp.department}
            {evaluation.reportGeneratedAt && ` · Generated ${format(new Date(evaluation.reportGeneratedAt), 'd MMM yyyy, HH:mm')}`}
          </p>
        </div>
        {actions}
      </header>

      <Section title="Executive Summary" ai label="Advisory — AI generated">
        <p className="max-w-prose whitespace-pre-line text-sm text-foreground" data-testid="executive-summary">
          {evaluation.executiveSummary}
        </p>
      </Section>

      <Section title="Vendor Scorecard">
        <ScoreBarChart data={bars} />
        <TableFrame label="Vendor scorecard">
          <TableHeader>
            <TableRow className="border-b border-border bg-muted hover:bg-muted">
              <TableHead className={headCell}>Criterion</TableHead>
              <TableHead className={cn(headCell, 'text-right')}>Weight</TableHead>
              {scored.map((v) => (
                <TableHead key={v.vendorAccountId} className={cn(headCell, 'text-right')}>
                  {v.companyName}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {evaluation.criteria.map((c) => (
              <TableRow key={c.id} className="border-b border-border bg-card hover:bg-card">
                <TableCell className={bodyCell}>{c.name}</TableCell>
                <TableCell className={cn(bodyCell, 'text-right')}>{c.weight}%</TableCell>
                {scored.map((v) => {
                  const s = v.scores.find((x) => x.criterionId === c.id)?.effectiveScore
                  return (
                    <TableCell key={v.vendorAccountId} className={cn(bodyCell, 'text-right tabular-nums')}>
                      {s === null || s === undefined ? '—' : (
                        <>
                          {s.toFixed(1)} <span className="text-xs text-muted-foreground">({((s * c.weight) / 100).toFixed(2)})</span>
                        </>
                      )}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
            <TableRow className="bg-accent font-semibold hover:bg-accent">
              <TableCell className={bodyCell}>Weighted total</TableCell>
              <TableCell className={cn(bodyCell, 'text-right')}>100%</TableCell>
              {scored.map((v) => (
                <TableCell key={v.vendorAccountId} className={cn(bodyCell, 'text-right tabular-nums')}>
                  {v.total?.toFixed(2)}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </TableFrame>
        <p className="text-xs text-muted-foreground">AI scores 0–10 with PM overrides applied; weighted contribution in brackets.</p>
      </Section>

      <Section title="Compliance Risk Summary">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-8">
          <TableFrame label="Compliance flags by vendor">
            <TableHeader>
              <TableRow className="border-b border-border bg-muted hover:bg-muted">
                <TableHead className={headCell}>Vendor</TableHead>
                <TableHead className={cn(headCell, 'text-right')}>High</TableHead>
                <TableHead className={cn(headCell, 'text-right')}>Medium</TableHead>
                <TableHead className={cn(headCell, 'text-right')}>Low</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.vendors.map((v) => (
                <TableRow key={v.vendorAccountId} className="border-b border-border bg-card hover:bg-card">
                  <TableCell className={bodyCell}>{v.companyName}</TableCell>
                  <TableCell className={cn(bodyCell, 'text-right')}>{v.flags.high}</TableCell>
                  <TableCell className={cn(bodyCell, 'text-right')}>{v.flags.medium}</TableCell>
                  <TableCell className={cn(bodyCell, 'text-right')}>{v.flags.low}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </TableFrame>
          <RiskDonut counts={totals} />
        </div>
      </Section>

      <Section title="Key Terms Comparison" ai label="AI extracted from vendor documents">
        <TableFrame label="Key terms comparison">
          <TableHeader>
            <TableRow className="border-b border-border bg-muted hover:bg-muted">
              <TableHead className={headCell}>Term</TableHead>
              {report.vendors.map((v) => (
                <TableHead key={v.vendorAccountId} className={headCell}>
                  {v.companyName}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {TERMS.map(([label, key]) => (
              <TableRow key={key} className="border-b border-border bg-card hover:bg-card">
                <TableCell className={cn(bodyCell, 'whitespace-nowrap font-medium')}>{label}</TableCell>
                {report.vendors.map((v) => (
                  <TableCell key={v.vendorAccountId} className={cn(bodyCell, 'whitespace-pre-line')}>
                    {v.keyTerms[key] ?? '—'}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </TableFrame>
      </Section>

      {/* Content Guidelines §8: distinct panel, violet-100 3px left border, advisory header. */}
      <section className="border-l-[3px] border-violet-100 py-1 pl-4" aria-labelledby="ai-recommendation" data-testid="ai-recommendation">
        <h2 id="ai-recommendation" className="text-xs font-medium text-violet-600">
          AI Recommendation — Advisory Only
        </h2>
        <div className="mt-2 flex items-start gap-1.5">
          <AiSparkles className="mt-1" />
          <div className="space-y-1.5">
            <p className="text-base font-semibold text-foreground">{rec?.vendorName ?? 'No vendor recommended'}</p>
            <p className="max-w-prose text-sm text-foreground">{rec?.rationale}</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Advisory — not a binding decision.</p>
      </section>
    </div>
  )
}
