import { useState, type CSSProperties } from 'react'

import type { DayStats } from '../../api/client'
import { dayOfMonth, formatDay, formatGW, weekdayInitial } from '../../lib/format'
import { symmetricExtent } from '../../lib/series'
import styles from './DayCalendar.module.css'

interface DayCalendarProps {
  days: DayStats[]
  selected: string
  onSelect: (day: string) => void
}

/**
 * One cell per delivery day, coloured on a diverging scale by that day's bias
 * (mean actual - forecast): red where wind fell short of the forecast, blue where
 * it beat it, grey near zero.
 */
export function DayCalendar({ days, selected, onSelect }: DayCalendarProps) {
  const [hovered, setHovered] = useState<string | null>(null)
  const extent = symmetricExtent(
    days.map((d) => d.bias_mw ?? 0),
    1000,
  )
  const focus = days.find((d) => d.delivery_day === (hovered ?? selected))

  return (
    <div>
      <div className={styles.strip} onMouseLeave={() => setHovered(null)}>
        {days.map((d) => {
          const bias = d.bias_mw ?? 0
          // Square-root scale keeps typical 1-2 GW days visible next to the extremes.
          const intensity = Math.sqrt(Math.min(Math.abs(bias) / extent, 1))
          const pole = bias < 0 ? 'var(--shortfall)' : 'var(--surplus)'
          const style = {
            '--cell': `color-mix(in oklab, ${pole} ${Math.round(intensity * 88)}%, var(--diverging-mid))`,
          } as CSSProperties
          const isSelected = d.delivery_day === selected
          return (
            <button
              key={d.delivery_day}
              type="button"
              className={styles.cell}
              style={style}
              data-strong={intensity > 0.5 || undefined}
              aria-pressed={isSelected}
              aria-label={`${formatDay(d.delivery_day)}: bias ${formatGW(d.bias_mw, { signed: true })}, mean absolute error ${formatGW(d.mae_mw)}`}
              onClick={() => onSelect(d.delivery_day)}
              onMouseEnter={() => setHovered(d.delivery_day)}
              onFocus={() => setHovered(d.delivery_day)}
              onBlur={() => setHovered(null)}
            >
              <span className={styles.weekday}>{weekdayInitial(d.delivery_day)}</span>
              <span className={styles.date}>{dayOfMonth(d.delivery_day)}</span>
            </button>
          )
        })}
      </div>

      <div className={styles.footer}>
        <p className={styles.readout} aria-live="polite">
          {focus && (
            <>
              <strong>{formatDay(focus.delivery_day)}</strong>
              <span>
                Bias <b>{formatGW(focus.bias_mw, { signed: true })}</b>
              </span>
              <span>
                Mean abs. error <b>{formatGW(focus.mae_mw)}</b>
              </span>
              <span>
                Worst shortfall <b>{formatGW(focus.worst_shortfall_mw)}</b>
              </span>
            </>
          )}
        </p>
        <div className={styles.scale} aria-hidden>
          <span>{formatGW(-extent, { digits: 0 })}</span>
          <span className={styles.gradient} />
          <span>{formatGW(extent, { signed: true, digits: 0 })}</span>
        </div>
      </div>
      <div className={styles.scaleLabels} aria-hidden>
        <span>Less wind than forecast</span>
        <span>More wind than forecast</span>
      </div>
    </div>
  )
}
