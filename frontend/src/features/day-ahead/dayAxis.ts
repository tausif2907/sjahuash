import type { ChartPoint } from '../../lib/series'

export const HALF_HOUR = 30 * 60 * 1000

/** Shared x-axis frame so the profile and the error bars line up exactly. */
export function dayAxis(points: ChartPoint[]) {
  const t0 = points[0]?.t ?? 0
  const t1 = points.at(-1)?.t ?? t0
  return {
    domain: [t0 - HALF_HOUR / 2, t1 + HALF_HOUR / 2] as [number, number],
    ticks: points.filter((_, i) => i % 6 === 0).map((p) => p.t),
  }
}
