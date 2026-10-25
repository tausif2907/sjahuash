/**
 * Number and date formatting. All times are shown in UK local time, the market's
 * clock; delivery days are plain calendar dates (YYYY-MM-DD).
 */

const UK_TZ = 'Europe/London'
const MINUS = '−' // typographic minus, aligns with "+"

const fixed = (digits: number) =>
  new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
const integer = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 })

type Maybe = number | null | undefined
const isMissing = (v: Maybe): v is null | undefined => v == null || Number.isNaN(v)

function sign(v: number, signed: boolean): string {
  if (v < 0) return MINUS
  return signed && v > 0 ? '+' : ''
}

export const DASH = '—'

/** 1234.5 -> "1,235 MW" */
export function formatMW(mw: Maybe, { signed = false } = {}): string {
  if (isMissing(mw)) return DASH
  return `${sign(mw, signed)}${integer.format(Math.abs(mw))} MW`
}

/** 2091 -> "2.09 GW"; two decimals below 10 GW, one above. */
export function formatGW(
  mw: Maybe,
  { signed = false, digits }: { signed?: boolean; digits?: number } = {},
): string {
  if (isMissing(mw)) return DASH
  const gw = mw / 1000
  const d = digits ?? (Math.abs(gw) < 10 ? 2 : 1)
  return `${sign(gw, signed)}${fixed(d).format(Math.abs(gw))} GW`
}

export function formatGWh(gwh: Maybe, { signed = false } = {}): string {
  if (isMissing(gwh)) return DASH
  return `${sign(gwh, signed)}${fixed(1).format(Math.abs(gwh))} GWh`
}

export function formatPct(pct: Maybe, { signed = false, digits = 1 } = {}): string {
  if (isMissing(pct)) return DASH
  return `${sign(pct, signed)}${fixed(digits).format(Math.abs(pct))}%`
}

export function formatHours(h: Maybe): string {
  if (isMissing(h)) return DASH
  return `${Number.isInteger(h) ? h : fixed(1).format(h)} h`
}

export function formatCount(n: Maybe): string {
  return isMissing(n) ? DASH : integer.format(n)
}

/** Axis ticks in GW without the unit (the axis label carries it). */
export function gwTick(mw: number): string {
  const gw = mw / 1000
  return `${gw < 0 ? MINUS : ''}${fixed(Number.isInteger(gw) ? 0 : 1).format(Math.abs(gw))}`
}

// --- dates -------------------------------------------------------------------

const dayShort = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})
const dayLong = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const dayCompact = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
})
const weekdayNarrow = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'narrow',
})
const ukTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: UK_TZ,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const ukDateTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: UK_TZ,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const dayToDate = (day: string) => new Date(`${day}T00:00:00Z`)

/** "2026-01-20" -> "Tue 20 Jan" */
export const formatDay = (day: string) => dayShort.format(dayToDate(day))
/** "2026-01-20" -> "Tuesday 20 January 2026" */
export const formatDayLong = (day: string) => dayLong.format(dayToDate(day))
/** "2026-01-20" -> "20 Jan" */
export const formatDayCompact = (day: string) => dayCompact.format(dayToDate(day))
export const weekdayInitial = (day: string) => weekdayNarrow.format(dayToDate(day))
export const dayOfMonth = (day: string) => dayToDate(day).getUTCDate()

/** ISO instant -> "07:30" (UK) */
export const formatTime = (iso: string | number) => ukTime.format(new Date(iso))
/** ISO instant -> "Mon 19 Jan, 07:30" (UK) */
export const formatDateTime = (iso: string | number) => ukDateTime.format(new Date(iso)).replace(' at ', ', ')
/** "09:20:00" -> "09:20" */
export const formatClock = (hhmmss: string) => hhmmss.slice(0, 5)

export function addDays(day: string, n: number): string {
  const d = dayToDate(day)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Inclusive list of days from first to last. */
export function daysBetween(first: string, last: string): string[] {
  const out: string[] = []
  for (let d = first; d <= last; d = addDays(d, 1)) out.push(d)
  return out
}

export function clampDay(day: string, first: string, last: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return last
  return day < first ? first : day > last ? last : day
}
