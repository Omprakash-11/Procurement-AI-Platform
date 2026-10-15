import { format } from 'date-fns'

import type { ReportView } from '@/lib/evaluation'

// Tech Stack §10.1: the comparison report rendered to a standalone HTML string for Puppeteer.
// Print output is always light; the palette below mirrors the light-theme tokens in
// globals.css and Content Guidelines §2 / §9 (the only colour literals, kept in one place).

const esc = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const SPARKLES = (size: number) =>
  `<svg class="ai" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/></svg>`

const scoreColour = (score: number) => (score >= 7 ? 'var(--success)' : score >= 4 ? 'var(--amber)' : 'var(--destructive)')

function barChart(report: ReportView): string {
  const vendors = report.vendors.filter((v) => v.total !== null).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
  if (!vendors.length) return ''
  const labelW = 170
  const chartW = 480
  const rowH = 40
  const height = vendors.length * rowH + 40
  const x = (v: number) => labelW + (v / 10) * chartW
  const ticks = [0, 2, 4, 6, 8, 10]
    .map((t) => `<line x1="${x(t)}" y1="0" x2="${x(t)}" y2="${vendors.length * rowH}" class="grid"/><text x="${x(t)}" y="${vendors.length * rowH + 16}" class="tick">${t}</text>`)
    .join('')
  const bars = vendors
    .map((v, i) => {
      const y = i * rowH + 8
      const total = v.total ?? 0
      return `<text x="${labelW - 8}" y="${y + 16}" class="label">${esc(v.companyName)}</text><rect x="${labelW}" y="${y}" width="${Math.max(1, x(total) - labelW)}" height="22" rx="2" fill="${scoreColour(total)}"/><text x="${x(total) + 6}" y="${y + 15}" class="value">${total.toFixed(1)}</text>`
    })
    .join('')
  return `<svg width="${labelW + chartW + 40}" height="${height}" class="chart" role="img" aria-label="Weighted total score per vendor">${ticks}${bars}</svg>`
}

function donut(counts: { high: number; medium: number; low: number }): string {
  const total = counts.high + counts.medium + counts.low
  const r = 67.5
  const c = 2 * Math.PI * r
  let offset = 0
  const segments = (
    [
      ['high', 'var(--risk-high)'],
      ['medium', 'var(--amber)'],
      ['low', 'var(--risk-low)'],
    ] as const
  )
    .map(([key, colour]) => {
      const len = total ? (counts[key] / total) * c : 0
      const seg = `<circle r="${r}" cx="100" cy="100" fill="none" stroke="${colour}" stroke-width="25" stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-offset}" transform="rotate(-90 100 100)"/>`
      offset += len
      return seg
    })
    .join('')
  const ring = total ? segments : `<circle r="${r}" cx="100" cy="100" fill="none" stroke="var(--muted)" stroke-width="25"/>`
  return `<svg width="200" height="200" role="img" aria-label="Compliance flags by severity">${ring}<text x="100" y="100" class="donut-total">${total}</text><text x="100" y="120" class="donut-label">Flags</text></svg>`
}

export function reportHtml(report: ReportView): string {
  const { evaluation } = report
  const vendors = report.vendors
  const scored = vendors.filter((v) => v.total !== null)
  const totals = vendors.reduce((t, v) => ({ high: t.high + v.flags.high, medium: t.medium + v.flags.medium, low: t.low + v.flags.low }), { high: 0, medium: 0, low: 0 })
  const totalFlags = totals.high + totals.medium + totals.low
  const pct = (n: number) => (totalFlags ? `${Math.round((n / totalFlags) * 100)}%` : '0%')

  const scorecardHead = `<tr><th>Criterion</th><th class="num">Weight</th>${scored.map((v) => `<th class="num">${esc(v.companyName)}</th>`).join('')}</tr>`
  const scorecardRows = evaluation.criteria
    .map((c) => {
      const cells = scored
        .map((v) => {
          const s = v.scores.find((x) => x.criterionId === c.id)?.effectiveScore
          return `<td class="num">${s === null || s === undefined ? '—' : `${s.toFixed(1)} <span class="muted">(${((s * c.weight) / 100).toFixed(2)})</span>`}</td>`
        })
        .join('')
      return `<tr><td>${esc(c.name)}</td><td class="num">${c.weight}%</td>${cells}</tr>`
    })
    .join('')
  const scorecardTotal = `<tr class="total"><td>Weighted total</td><td class="num">100%</td>${scored.map((v) => `<td class="num">${v.total?.toFixed(2)}</td>`).join('')}</tr>`

  const riskRows = vendors.map((v) => `<tr><td>${esc(v.companyName)}</td><td class="num">${v.flags.high}</td><td class="num">${v.flags.medium}</td><td class="num">${v.flags.low}</td></tr>`).join('')
  const termRows = (
    [
      ['Price', 'pricing'],
      ['Payment terms', 'paymentTerms'],
      ['Delivery', 'delivery'],
      ['SLA', 'sla'],
    ] as const
  )
    .map(([label, key]) => `<tr><td class="term">${label}</td>${vendors.map((v) => `<td>${esc(v.keyTerms[key] ?? '—')}</td>`).join('')}</tr>`)
    .join('')
  const rec = evaluation.recommendation

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(report.rfp.title)} — Comparison Report</title>
<style>
  :root { --foreground:#0F172A; --muted-foreground:#64748B; --border:#E2E8F0; --muted:#F1F5F9; --primary:#1D4ED8;
          --success:#22C55E; --amber:#FBBF24; --destructive:#DC2626; --risk-high:#F87171; --risk-low:#CBD5E1;
          --violet-500:#8B5CF6; --violet-600:#7C3AED; --violet-100:#EDE9FE; }
  * { box-sizing: border-box; }
  body { font-family: Inter, "Segoe UI", Arial, sans-serif; color: var(--foreground); font-size: 11px; line-height: 1.5; margin: 0; }
  h1 { font-size: 22px; margin: 0 0 4px; } h2 { font-size: 15px; margin: 28px 0 10px; display: flex; align-items: center; gap: 6px; }
  .muted, .meta { color: var(--muted-foreground); } .meta { margin-bottom: 8px; }
  .ai { color: var(--violet-500); flex: none; } .ai-label { color: var(--violet-600); font-size: 10px; font-weight: 500; margin: -6px 0 8px; }
  table { width: 100%; border-collapse: collapse; page-break-inside: auto; } tr { page-break-inside: avoid; }
  th { text-align: left; font-size: 10px; color: var(--muted-foreground); font-weight: 600; border-bottom: 1px solid var(--border); padding: 6px 8px; }
  td { border-bottom: 1px solid var(--border); padding: 6px 8px; vertical-align: top; } .num { text-align: right; white-space: nowrap; }
  tr.total td { font-weight: 600; background: var(--muted); } td.term { font-weight: 500; white-space: nowrap; }
  .chart .grid { stroke: var(--border); } .chart .tick { font-size: 10px; fill: var(--muted-foreground); text-anchor: middle; }
  .chart .label { font-size: 11px; fill: var(--foreground); text-anchor: end; } .chart .value { font-size: 10px; font-weight: 500; fill: var(--foreground); }
  .risk { display: flex; gap: 24px; align-items: flex-start; break-inside: avoid; } h2 { break-after: avoid; } .rec { break-inside: avoid; } .risk table { flex: 1; }
  .legend { list-style: none; padding: 0; margin: 8px 0 0; } .legend li { display: flex; align-items: center; gap: 6px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  .donut-total { font-size: 22px; font-weight: 600; text-anchor: middle; fill: var(--foreground); } .donut-label { font-size: 10px; text-anchor: middle; fill: var(--muted-foreground); }
  .rec { border-left: 3px solid var(--violet-100); padding: 4px 0 4px 12px; margin-top: 8px; }
  .rec .head { color: var(--violet-600); font-size: 10px; font-weight: 500; }
  p { margin: 0 0 6px; } .flex { display: flex; gap: 6px; align-items: flex-start; }
</style></head>
<body>
  <h1>${esc(report.rfp.title)}</h1>
  <div class="meta">Comparison report · ${esc(report.orgName)} · ${esc(report.rfp.department)}${evaluation.reportGeneratedAt ? ` · Generated ${esc(format(new Date(evaluation.reportGeneratedAt), 'd MMM yyyy, HH:mm'))}` : ''}</div>

  <h2>${SPARKLES(16)}Executive Summary</h2>
  <div class="ai-label">Advisory — AI generated</div>
  <p>${esc(evaluation.executiveSummary ?? '')}</p>

  <h2>Vendor Scorecard</h2>
  ${barChart(report)}
  <table><thead>${scorecardHead}</thead><tbody>${scorecardRows}${scorecardTotal}</tbody></table>
  <p class="muted" style="margin-top:6px">Scores 0–10 (AI-scored, PM overrides applied); weighted contribution in brackets.</p>

  <h2>Compliance Risk Summary</h2>
  <div class="risk">
    <table><thead><tr><th>Vendor</th><th class="num">High</th><th class="num">Medium</th><th class="num">Low</th></tr></thead><tbody>${riskRows}</tbody></table>
    <div>${donut(totals)}
      <ul class="legend">
        <li><span class="dot" style="background:var(--risk-high)"></span>High Risk ${totals.high} (${pct(totals.high)})</li>
        <li><span class="dot" style="background:var(--amber)"></span>Medium Risk ${totals.medium} (${pct(totals.medium)})</li>
        <li><span class="dot" style="background:var(--risk-low)"></span>Low Risk ${totals.low} (${pct(totals.low)})</li>
      </ul>
    </div>
  </div>

  <h2>${SPARKLES(14)}Key Terms Comparison</h2>
  <table><thead><tr><th>Term</th>${vendors.map((v) => `<th>${esc(v.companyName)}</th>`).join('')}</tr></thead><tbody>${termRows}</tbody></table>

  <div class="rec">
    <div class="head">AI Recommendation — Advisory Only</div>
    <div class="flex">${SPARKLES(14)}<div>
      <p><strong>${esc(rec?.vendorName ?? 'No vendor recommended')}</strong></p>
      <p>${esc(rec?.rationale ?? '')}</p>
    </div></div>
    <p class="muted">Advisory — not a binding decision.</p>
  </div>
</body></html>`
}
