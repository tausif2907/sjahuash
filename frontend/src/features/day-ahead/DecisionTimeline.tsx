import type { CSSProperties } from 'react'

import { addDays, formatDay, formatHours, formatTime } from '../../lib/format'
import styles from './DecisionTimeline.module.css'

interface DecisionTimelineProps {
  day: string
  publishTime: string | null
  cutoff: string
  gateName: string
  minHorizon: number | null
  maxHorizon: number | null
}

const HOUR = 3_600_000

/**
 * The 48 hours from D-1 00:00 to the end of delivery day D, with the forecast run
 * that was used, the gate closure it had to beat, and the delivery window.
 */
export function DecisionTimeline({
  day,
  publishTime,
  cutoff,
  gateName,
  minHorizon,
  maxHorizon,
}: DecisionTimelineProps) {
  // UK midnight starting D-1: UTC midnight, minus an hour when the UK is on BST.
  const utcMidnight = Date.parse(`${addDays(day, -1)}T00:00:00Z`)
  const start = utcMidnight - Number(formatTime(utcMidnight).slice(0, 2)) * HOUR
  const pos = (iso: string) =>
    `${Math.max(0, Math.min(100, ((Date.parse(iso) - start) / (48 * HOUR)) * 100))}%`
  const ticks = Array.from({ length: 9 }, (_, i) => i * 6)

  return (
    <div className={styles.timeline}>
      <div className={styles.days} aria-hidden>
        <span>D−1 · {formatDay(addDays(day, -1))}</span>
        <span className={styles.deliveryLabel}>Delivery day · {formatDay(day)}</span>
      </div>

      <div className={styles.track}>
        <div className={styles.delivery} />
        {ticks.map((h) => (
          <span key={h} className={styles.tick} style={{ left: `${(h / 48) * 100}%` }}>
            <span>{String(h % 24).padStart(2, '0')}:00</span>
          </span>
        ))}

        {publishTime && (
          <div
            className={styles.marker}
            data-kind="publish"
            style={{ left: pos(publishTime) } as CSSProperties}
          >
            <span className={styles.dot} />
            <span className={styles.label} data-side="top">
              <b>Forecast published</b> {formatTime(publishTime)}
            </span>
          </div>
        )}
        <div className={styles.marker} data-kind="gate" style={{ left: pos(cutoff) } as CSSProperties}>
          <span className={styles.line} />
          <span className={styles.label} data-side="bottom">
            <b>{gateName} gate closure</b> {formatTime(cutoff)}
          </span>
        </div>
      </div>

      <p className={styles.caption}>
        The trade for every half-hour of {formatDay(day)} had to be placed before {formatTime(cutoff)} the day
        before, so the latest usable forecast is the run published at{' '}
        {publishTime ? formatTime(publishTime) : '—'}. It looked{' '}
        <b>
          {formatHours(minHorizon)} to {formatHours(maxHorizon)}
        </b>{' '}
        ahead. Later runs on D−1 arrived too late to trade on.
      </p>
    </div>
  )
}
