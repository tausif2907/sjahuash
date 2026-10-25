import { describe, expect, it } from 'vitest'

import type { SeriesPoint } from '../api/client'
import { dayEnergy, errorsOf, histogram, symmetricExtent, toChartPoints, worstShortfall } from './series'

const point = (start: string, actual: number | null, forecast: number | null = null): SeriesPoint => ({
  start_time: start,
  actual_mw: actual,
  forecast_mw: forecast,
  error_mw: actual != null && forecast != null ? actual - forecast : null,
  publish_time: forecast != null ? '2026-01-01T07:30:00Z' : null,
  horizon_h: forecast != null ? 16.5 : null,
  cutoff: '2026-01-01T09:20:00Z',
})

const DAY: SeriesPoint[] = [
  point('2026-01-02T00:00:00Z', 1000, 1500),
  point('2026-01-02T00:30:00Z', 1200),
  point('2026-01-02T01:00:00Z', 2000, 1800),
  point('2026-01-02T01:30:00Z', 2200),
]

describe('toChartPoints', () => {
  it('adds the historical error band around hourly forecasts only', () => {
    const pts = toChartPoints(DAY, { p10: -400, p90: 100 })
    expect(pts[0].band).toEqual([1100, 1600])
    expect(pts[1].band).toBeNull()
    expect(pts[0].t).toBe(Date.parse('2026-01-02T00:00:00Z'))
  })

  it('omits the band when none is given', () => {
    expect(toChartPoints(DAY)[0].band).toBeNull()
  })
})

describe('dayEnergy', () => {
  it('integrates both half-hours of each forecast hour', () => {
    const e = dayEnergy(DAY)
    // Actual: (1000 + 1200) * 0.5 + (2000 + 2200) * 0.5 = 3200 MWh; forecast: 1500 + 1800 = 3300 MWh.
    expect(e.actualGWh).toBeCloseTo(3.2)
    expect(e.forecastGWh).toBeCloseTo(3.3)
    expect(e.gapGWh).toBeCloseTo(-0.1)
    expect(e.gapPct).toBeCloseTo((-100 / 3300) * 100)
  })

  it('ignores hours without a forecast', () => {
    const e = dayEnergy([point('2026-01-02T00:00:00Z', 1000), point('2026-01-02T00:30:00Z', 1000)])
    expect(e.forecastGWh).toBe(0)
    expect(e.gapPct).toBeNull()
  })
})

describe('worstShortfall and errorsOf', () => {
  it('finds the most negative error', () => {
    expect(worstShortfall(DAY)?.start_time).toBe('2026-01-02T00:00:00Z')
  })

  it('returns null when nothing fell short', () => {
    expect(worstShortfall([point('2026-01-02T00:00:00Z', 2000, 1000)])).toBeNull()
  })

  it('collects only defined errors', () => {
    expect(errorsOf(DAY)).toEqual([-500, 200])
  })
})

describe('histogram', () => {
  it('aligns bins on zero so no bin straddles shortfall and surplus', () => {
    const bins = histogram([-900, -100, -50, 20, 480, 510], 500)
    expect(bins.map((b) => [b.x0, b.count])).toEqual([
      [-1000, 1],
      [-500, 2],
      [0, 2],
      [500, 1],
    ])
    expect(bins.reduce((s, b) => s + b.share, 0)).toBeCloseTo(1)
  })

  it('is empty for no values', () => {
    expect(histogram([], 500)).toEqual([])
  })
})

describe('symmetricExtent', () => {
  it('rounds the largest magnitude up to a clean step', () => {
    expect(symmetricExtent([-4250, 406], 1000)).toBe(5000)
    expect(symmetricExtent([10, -20], 1000)).toBe(1000)
  })
})
