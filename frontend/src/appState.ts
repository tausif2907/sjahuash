import type { Meta } from './api/client'
import { clampDay, formatClock } from './lib/format'
import { useUrlState } from './lib/urlState'

export type View = 'day' | 'accuracy' | 'method'
export type GateName = 'EPEX' | 'N2EX'

/** Empty strings mean "derive from the data" (e.g. the latest delivery day). */
const DEFAULTS = {
  view: 'day',
  day: '',
  gate: 'EPEX',
  from: '',
  to: '',
  mode: 'decision',
  h: '24',
} as const

export const useAppState = () => useUrlState(DEFAULTS)

export const VIEWS: View[] = ['day', 'accuracy', 'method']
export const asView = (v: string): View => (VIEWS.includes(v as View) ? (v as View) : 'day')

export function resolveGate(meta: Meta, gate: string): { name: GateName; time: string } {
  const name: GateName = gate === 'N2EX' ? 'N2EX' : 'EPEX'
  const raw = meta.gate_closures[name] ?? meta.default_gate_closure
  return { name, time: formatClock(raw) }
}

export function resolveRange(meta: Meta, from: string, to: string): { start: string; end: string } {
  let start = clampDay(from || meta.first_day, meta.first_day, meta.last_day)
  let end = clampDay(to || meta.last_day, meta.first_day, meta.last_day)
  if (start > end) [start, end] = [end, start]
  return { start, end }
}
