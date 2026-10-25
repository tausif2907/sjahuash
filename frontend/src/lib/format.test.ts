import { describe, expect, it } from 'vitest'

import {
  addDays,
  clampDay,
  daysBetween,
  formatDateTime,
  formatDay,
  formatGW,
  formatGWh,
  formatHours,
  formatMW,
  formatPct,
  formatTime,
  gwTick,
} from './format'

describe('number formatting', () => {
  it('uses a typographic minus and optional plus sign', () => {
    expect(formatGW(-1823.4)).toBe('−1.82 GW')
    expect(formatGW(406, { signed: true })).toBe('+0.41 GW')
    expect(formatGW(0, { signed: true })).toBe('0.00 GW')
  })

  it('drops to one decimal from 10 GW', () => {
    expect(formatGW(12_345)).toBe('12.3 GW')
    expect(formatGW(12_345, { digits: 0 })).toBe('12 GW')
  })

  it('formats MW with thousands separators', () => {
    expect(formatMW(14_602)).toBe('14,602 MW')
    expect(formatMW(-1232, { signed: true })).toBe('−1,232 MW')
  })

  it('shows a dash for missing values', () => {
    expect(formatMW(null)).toBe('—')
    expect(formatGW(undefined)).toBe('—')
    expect(formatPct(Number.NaN)).toBe('—')
  })

  it('formats energy, percentages and hours', () => {
    expect(formatGWh(-23.64, { signed: true })).toBe('−23.6 GWh')
    expect(formatPct(18.27)).toBe('18.3%')
    expect(formatHours(16.5)).toBe('16.5 h')
    expect(formatHours(24)).toBe('24 h')
  })

  it('renders axis ticks in GW without a unit', () => {
    expect(gwTick(12_500)).toBe('12.5')
    expect(gwTick(-4000)).toBe('−4')
    expect(gwTick(0)).toBe('0')
  })
})

describe('dates', () => {
  it('formats delivery days as calendar dates', () => {
    expect(formatDay('2026-01-20')).toBe('Tue 20 Jan')
  })

  it('shows instants in UK time, including British Summer Time', () => {
    expect(formatTime('2026-01-20T07:30:00Z')).toBe('07:30')
    expect(formatTime('2026-07-01T08:20:00Z')).toBe('09:20')
    expect(formatDateTime('2026-01-19T07:30:00Z')).toBe('Mon 19 Jan, 07:30')
  })

  it('does day arithmetic across month ends', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-02-01', -1)).toBe('2026-01-31')
    expect(daysBetween('2026-01-30', '2026-02-01')).toEqual(['2026-01-30', '2026-01-31', '2026-02-01'])
  })

  it('clamps days into the available range and rejects junk', () => {
    expect(clampDay('2025-12-01', '2026-01-01', '2026-02-01')).toBe('2026-01-01')
    expect(clampDay('2026-03-01', '2026-01-01', '2026-02-01')).toBe('2026-02-01')
    expect(clampDay('not-a-date', '2026-01-01', '2026-02-01')).toBe('2026-02-01')
    expect(clampDay('2026-01-15', '2026-01-01', '2026-02-01')).toBe('2026-01-15')
  })
})
