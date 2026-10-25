/**
 * Pure transforms from API payloads to what the charts and tiles need.
 * Error convention matches the API: error = actual - forecast, negative = shortfall.
 */
import type { SeriesPoint } from '../api/client'

export interface ChartPoint {
  t: number // epoch ms, start of the half-hour
  actual: number | null
  forecast: number | null // hourly; null on the half-hour
  error: number | null
  band: [number, number] | null // forecast + P10 .. forecast + P90 of historical error
  publishTime: string | null
  horizonH: number | null
}

export interface ErrorBand {
  p10: number
  p90: number
}

export function toChartPoints(points: SeriesPoint[], band?: ErrorBand | null): ChartPoint[] {
  return points.map((p) => ({
    t: Date.parse(p.start_time),
    actual: p.actual_mw ?? null,
    forecast: p.forecast_mw ?? null,
    error: p.error_mw ?? null,
    band: band && p.forecast_mw != null ? [p.forecast_mw + band.p10, p.forecast_mw + band.p90] : null,
    publishTime: p.publish_time ?? null,
    horizonH: p.horizon_h ?? null,
  }))
}

export interface DayEnergy {
  actualGWh: number
  forecastGWh: number
  gapGWh: number // actual - forecast
  gapPct: number | null // gap relative to forecast
}

/**
 * Energy over the day. Actuals are half-hourly averages (x 0.5 h); forecasts are
 * hourly values (x 1 h). Only hours that have both are counted, so a missing hour
 * cannot masquerade as a shortfall.
 */
export function dayEnergy(points: SeriesPoint[]): DayEnergy {
  const byTime = new Map(points.map((p) => [Date.parse(p.start_time), p]))
  let actual = 0
  let forecast = 0
  for (const p of points) {
    if (p.forecast_mw == null || p.actual_mw == null) continue
    const next = byTime.get(Date.parse(p.start_time) + 30 * 60 * 1000)
    const secondHalf = next?.actual_mw ?? p.actual_mw
    actual += (p.actual_mw + secondHalf) * 0.5
    forecast += p.forecast_mw
  }
  const gap = actual - forecast
  return {
    actualGWh: actual / 1000,
    forecastGWh: forecast / 1000,
    gapGWh: gap / 1000,
    gapPct: forecast ? (gap / forecast) * 100 : null,
  }
}

/** The hour with the largest shortfall (most negative error), if any. */
export function worstShortfall(points: SeriesPoint[]): SeriesPoint | null {
  let worst: SeriesPoint | null = null
  for (const p of points) {
    if (p.error_mw == null || p.error_mw >= 0) continue
    if (!worst || p.error_mw < (worst.error_mw ?? 0)) worst = p
  }
  return worst
}

export const errorsOf = (points: SeriesPoint[]): number[] =>
  points.flatMap((p) => (p.error_mw == null ? [] : [p.error_mw]))

export interface Bin {
  x0: number
  x1: number
  mid: number
  count: number
  share: number // fraction of all errors
}

/** Fixed-width bins aligned on zero, so no bin straddles shortfall and surplus. */
export function histogram(values: number[], binWidth: number): Bin[] {
  if (!values.length) return []
  const lo = Math.floor(Math.min(...values) / binWidth)
  const hi = Math.floor(Math.max(...values) / binWidth)
  const counts = new Array<number>(hi - lo + 1).fill(0)
  for (const v of values) counts[Math.floor(v / binWidth) - lo] += 1
  return counts.map((count, i) => {
    const x0 = (lo + i) * binWidth
    return {
      x0,
      x1: x0 + binWidth,
      mid: x0 + binWidth / 2,
      count,
      share: count / values.length,
    }
  })
}

/** Symmetric domain for a diverging scale, rounded up to a clean step. */
export function symmetricExtent(values: number[], step: number): number {
  const max = Math.max(step, ...values.map((v) => Math.abs(v)))
  return Math.ceil(max / step) * step
}
