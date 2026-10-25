/**
 * Chart chrome shared by every chart. Colours are CSS variables, so charts follow
 * the light/dark theme without re-rendering.
 */
export const C = {
  actual: 'var(--series-actual)',
  forecast: 'var(--series-forecast)',
  band: 'var(--band-forecast)',
  shortfall: 'var(--shortfall)',
  surplus: 'var(--surplus)',
  neutral: 'var(--series-neutral)',
  grid: 'var(--grid)',
  axis: 'var(--axis)',
  muted: 'var(--ink-muted)',
  ink: 'var(--ink-2)',
  surface: 'var(--surface)',
  accent: 'var(--accent)',
  accentWash: 'var(--accent-wash)',
} as const

export const axisProps = {
  stroke: C.axis,
  tick: { fill: C.muted, fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: C.axis },
} as const

export const yAxisProps = {
  ...axisProps,
  axisLine: false,
  width: 44,
} as const

export const gridProps = { stroke: C.grid, vertical: false } as const

export const chartMargin = { top: 8, right: 12, bottom: 4, left: 0 }

export const signColor = (v: number | null | undefined) => ((v ?? 0) < 0 ? C.shortfall : C.surplus)

/**
 * Round tick positions (steps of 1, 2, 2.5 or 5 x 10^n) covering [min, max].
 * Always at least two ticks, so a flat series never yields a zero-height domain.
 */
export function niceTicks(min: number, max: number, target = 5): number[] {
  const raw = (max - min || 1) / target
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag
  const lo = Math.floor(min / step) * step
  const hi = Math.max(Math.ceil(max / step) * step, lo + step)
  const ticks: number[] = []
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6)
  return ticks
}
