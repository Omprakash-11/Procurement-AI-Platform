'use client'

import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'

import { cn } from '@/lib/utils'

type StatCardProps = { label: string; value: number | string; icon: LucideIcon; spark: number[]; href?: string; testId: string }

// Content Guidelines §6.4 stat card: label, Cal Sans value, 20px icon in a 40px primary-tint
// circle (top-right), sparkline at the bottom (§9.2).
export function StatCard({ label, value, icon: Icon, spark, href, testId }: StatCardProps) {
  const body = (
    <div
      className={cn(
        'rounded border border-border bg-card p-6 shadow-sm',
        href && 'motion-safe:transition-shadow motion-safe:duration-150 hover:shadow-md'
      )}
      data-testid={testId}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 font-heading text-3xl text-foreground" data-testid={`${testId}-value`}>
            {value}
          </p>
        </div>
        <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
      <Sparkline data={spark} label={`${label}, activity over the last 30 days`} />
    </div>
  )
  return href ? (
    <Link href={href} className="block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {body}
    </Link>
  ) : (
    body
  )
}

// Content Guidelines §9.2: AreaChart, no axes / grid / tooltip, 48px tall, stroke --primary,
// fill --primary at 0.1, strokeWidth 1.5. Colours are read from the CSS variable (§9 rule)
// and re-read when the theme changes.
function Sparkline({ data, label }: { data: number[]; label: string }) {
  const { resolvedTheme } = useTheme()
  const [color, setColor] = useState<string | null>(null)
  useEffect(() => {
    const value = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()
    setColor(value ? `hsl(${value})` : null)
  }, [resolvedTheme])

  const points = data.map((v, i) => ({ i, v }))
  return (
    <div className="mt-4 h-12" role="img" aria-label={label}>
      {color && (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
            <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={color} fillOpacity={0.1} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
