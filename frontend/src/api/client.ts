/**
 * Typed access to the FastAPI backend. Types come from the generated OpenAPI
 * schema (npm run gen:api), so a backend change that breaks the contract fails
 * the frontend type check instead of failing at runtime.
 */
import type { components } from './schema'

type Schemas = components['schemas']
export type Meta = Schemas['MetaResponse']
export type SeriesResponse = Schemas['SeriesResponse']
export type SeriesPoint = Schemas['SeriesPoint']
export type MetricsResponse = Schemas['MetricsResponse']
export type Stats = Schemas['Stats']
export type DayStats = Schemas['DayStats']
export type HourStats = Schemas['HourStats']
export type HorizonProfile = Schemas['HorizonProfileResponse']
export type HorizonStats = Schemas['HorizonStats']

export type Mode = 'decision' | 'horizon'

export interface Selection {
  start: string
  end: string
  mode: Mode
  gateClosure?: string // "HH:MM", decision mode
  horizonH?: number // horizon mode
}

const BASE = import.meta.env.VITE_API_BASE ?? ''

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function getJson<T>(path: string, params: Record<string, string | number | undefined> = {}) {
  const query = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined) query.set(k, String(v))
  const url = `${BASE}${path}${query.size ? `?${query}` : ''}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const detail = typeof body?.detail === 'string' ? body.detail : res.statusText
    throw new ApiError(res.status, detail || `Request failed (${res.status})`)
  }
  return (await res.json()) as T
}

const selectionParams = (s: Selection) => ({
  start: s.start,
  end: s.end,
  mode: s.mode,
  gate_closure: s.mode === 'decision' ? s.gateClosure : undefined,
  horizon_h: s.mode === 'horizon' ? s.horizonH : undefined,
})

export const api = {
  meta: () => getJson<Meta>('/api/meta'),
  series: (s: Selection) => getJson<SeriesResponse>('/api/series', selectionParams(s)),
  metrics: (s: Selection) => getJson<MetricsResponse>('/api/metrics', selectionParams(s)),
  horizonProfile: (start: string, end: string, maxH = 48) =>
    getJson<HorizonProfile>('/api/metrics/by-horizon', {
      start,
      end,
      max_h: maxH,
      step_h: 1,
    }),
}
