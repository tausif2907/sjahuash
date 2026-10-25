import { addDays, daysBetween, formatDay, formatDayCompact } from '../../lib/format'
import styles from './DateRange.module.css'

interface DateRangeProps {
  start: string
  end: string
  first: string
  last: string
  onChange: (start: string, end: string) => void
}

interface Preset {
  key: string
  label: string
  start: string
  end: string
}

/** Whole period plus consecutive 7-day weeks from the first day. */
function presetsFor(first: string, last: string): Preset[] {
  const presets: Preset[] = [{ key: 'all', label: 'Whole period', start: first, end: last }]
  for (let s = first, i = 1; s <= last; s = addDays(s, 7), i++) {
    const e = addDays(s, 6) < last ? addDays(s, 6) : last
    presets.push({
      key: `w${i}`,
      label: `Week ${i} · ${formatDayCompact(s)}–${formatDayCompact(e)}`,
      start: s,
      end: e,
    })
  }
  return presets
}

export function DateRange({ start, end, first, last, onChange }: DateRangeProps) {
  const presets = presetsFor(first, last)
  const active = presets.find((p) => p.start === start && p.end === end)?.key ?? 'custom'

  return (
    <div className={styles.range}>
      <select
        className={styles.control}
        value={active}
        aria-label="Period preset"
        onChange={(e) => {
          const p = presets.find((x) => x.key === e.target.value)
          if (p) onChange(p.start, p.end)
        }}
      >
        {presets.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
        {active === 'custom' && <option value="custom">Custom range</option>}
      </select>
      {/* Day lists rather than <input type="date">, whose format follows the browser locale
          (01-02-2026 reads as 1 Feb in the UK and 2 Jan in the US). */}
      <div className={styles.dates}>
        <select
          className={styles.control}
          aria-label="From"
          value={start}
          onChange={(e) => onChange(e.target.value, end)}
        >
          {daysBetween(first, end).map((d) => (
            <option key={d} value={d}>
              {formatDay(d)}
            </option>
          ))}
        </select>
        <span className={styles.sep} aria-hidden>
          –
        </span>
        <select
          className={styles.control}
          aria-label="To"
          value={end}
          onChange={(e) => onChange(start, e.target.value)}
        >
          {daysBetween(start, last).map((d) => (
            <option key={d} value={d}>
              {formatDay(d)}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
