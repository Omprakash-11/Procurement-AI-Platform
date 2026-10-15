'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Bar, BarChart, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import type { FlagCounts } from '@/lib/evaluation'

// Content Guidelines §9: chart colours come from CSS variables read with getComputedStyle, so
// they follow light / dark mode — never hex in chart configs.
const TOKENS = ['--chart-good', '--chart-mid', '--destructive', '--chart-risk-high', '--chart-risk-low', '--muted-foreground', '--foreground', '--border', '--popover', '--popover-foreground'] as const
type Token = (typeof TOKENS)[number]

function useChartColours(): Record<Token, string> | null {
  const { resolvedTheme } = useTheme()
  const [colours, setColours] = useState<Record<Token, string> | null>(null)
  useEffect(() => {
    const style = getComputedStyle(document.documentElement)
    setColours(Object.fromEntries(TOKENS.map((t) => [t, `hsl(${style.getPropertyValue(t).trim()})`])) as Record<Token, string>)
  }, [resolvedTheme])
  return colours
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

type BarDatum = { name: string; total: number; rank: number }

// §9.1 Vendor score bar chart: horizontal bars, x = weighted total 0–10, y = vendor names;
// ≥ 7 success, 4–6.9 amber, < 4 destructive; 40px per vendor + 40px axes; value at bar end;
// tooltip: vendor, total, rank; no legend.
export function ScoreBarChart({ data }: { data: BarDatum[] }) {
  const c = useChartColours()
  if (!c || data.length === 0) return <div style={{ height: data.length * 40 + 40 }} />
  const fill = (v: number) => (v >= 7 ? c['--chart-good'] : v >= 4 ? c['--chart-mid'] : c['--destructive'])

  return (
    <div style={{ height: data.length * 40 + 40 }} role="img" aria-label={`Weighted total score per vendor: ${data.map((d) => `${d.name} ${d.total.toFixed(1)}`).join(', ')}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, bottom: 4, left: 8 }}>
          <XAxis type="number" domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fontSize: 12, fill: c['--muted-foreground'] }} axisLine={{ stroke: c['--border'] }} tickLine={false} />
          <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 12, fill: c['--foreground'] }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: c['--border'], opacity: 0.4 }}
            contentStyle={{ background: c['--popover'], border: `1px solid ${c['--border']}`, borderRadius: 4, fontSize: 12, color: c['--popover-foreground'] }}
            formatter={(value: number, _name, item) => [`${value.toFixed(2)} / 10 · Rank ${(item.payload as BarDatum).rank}`, 'Total score']}
          />
          <Bar dataKey="total" barSize={22} radius={[0, 4, 4, 0]} isAnimationActive={!reducedMotion()}>
            {data.map((d) => (
              <Cell key={d.name} fill={fill(d.total)} />
            ))}
            <LabelList dataKey="total" position="right" formatter={(v: number) => v.toFixed(1)} style={{ fontSize: 12, fontWeight: 500, fill: c['--foreground'] }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// §9.3 Compliance risk donut: 200×200, inner 55 / outer 80; High red-400, Medium amber-400,
// Low slate-300; centre = total + "Flags"; legend right (dot + label + count); tooltip shows
// segment, count and share of total.
export function RiskDonut({ counts }: { counts: FlagCounts }) {
  const c = useChartColours()
  const total = counts.high + counts.medium + counts.low
  const segments = [
    { key: 'high', name: 'High Risk', value: counts.high, colour: c?.['--chart-risk-high'] },
    { key: 'medium', name: 'Medium Risk', value: counts.medium, colour: c?.['--chart-mid'] },
    { key: 'low', name: 'Low Risk', value: counts.low, colour: c?.['--chart-risk-low'] },
  ]

  return (
    <div className="flex items-center gap-6">
      <div className="relative size-[200px] shrink-0" role="img" aria-label={`Compliance flags: ${segments.map((s) => `${s.name} ${s.value}`).join(', ')}`}>
        {c && (
          <PieChart width={200} height={200}>
            <Pie
              data={total ? segments : [{ key: 'none', name: 'No flags', value: 1, colour: c['--border'] }]}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={80}
              stroke={c['--popover']}
              strokeWidth={2}
              isAnimationActive={!reducedMotion()}
            >
              {(total ? segments : [{ key: 'none', colour: c['--border'] }]).map((s) => (
                <Cell key={s.key} fill={s.colour} />
              ))}
            </Pie>
            {total > 0 && (
              <Tooltip
                contentStyle={{ background: c['--popover'], border: `1px solid ${c['--border']}`, borderRadius: 4, fontSize: 12, color: c['--popover-foreground'] }}
                formatter={(value: number, name: string) => [`${value} (${Math.round((value / total) * 100)}%)`, name]}
              />
            )}
          </PieChart>
        )}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-heading text-2xl text-foreground">{total}</span>
          <span className="text-xs text-muted-foreground">Flags</span>
        </div>
      </div>
      <ul className="space-y-2 text-sm">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: s.colour }} aria-hidden="true" />
            <span className="text-foreground">{s.name}</span>
            <span className="font-medium text-foreground">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
