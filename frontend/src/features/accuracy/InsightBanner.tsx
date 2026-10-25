import { ShieldAlert } from 'lucide-react'

import type { SeriesPoint, Stats } from '../../api/client'
import { formatDateTime, formatGW, formatPct } from '../../lib/format'
import styles from './InsightBanner.module.css'

interface InsightBannerProps {
  overall: Stats
  errors: number[]
  worst: SeriesPoint | null
  /** How the forecasts were chosen, e.g. "at the EPEX gate closure (09:20 on D−1)". */
  context: string
}

/**
 * The single number the desk can act on: how much extra cover would have absorbed
 * the forecast shortfall in 9 out of 10 hours (minus the P10 error).
 */
export function InsightBanner({ overall, errors, worst, context }: InsightBannerProps) {
  const bias = overall.bias_mw ?? 0
  const cover = Math.max(0, -(overall.p10_mw ?? 0))
  const over = errors.length ? (errors.filter((e) => e < 0).length / errors.length) * 100 : 0
  const overEstimated = bias < 0
  const share = overEstimated ? over : 100 - over

  return (
    <section className={styles.banner} aria-label="Key finding">
      <div className={styles.hero}>
        <span className={styles.eyebrow}>
          <ShieldAlert size={14} aria-hidden /> Recommended cover
        </span>
        <span className={styles.figure}>{formatGW(cover)}</span>
        <span className={styles.caption}>extra supply to hold back to cover shortfalls in 9 of 10 hours</span>
      </div>
      <div className={styles.body}>
        <p className={styles.sentence}>
          Forecasts available {context} <b>{overEstimated ? 'over-estimated' : 'under-estimated'}</b> wind in{' '}
          <b>{formatPct(share, { digits: 0 })}</b> of hours, by <b>{formatGW(Math.abs(bias))}</b> on average.
          That is a systematic bias, not random noise, and a buyer can plan around it.
        </p>
        <dl className={styles.facts}>
          <div>
            <dt>Typical miss</dt>
            <dd>{formatGW(overall.mae_mw)}</dd>
          </div>
          <div>
            <dt>Middle 80% of errors</dt>
            <dd>
              {formatGW(overall.p10_mw, { signed: true, digits: 1 })} to{' '}
              {formatGW(overall.p90_mw, { signed: true, digits: 1 })}
            </dd>
          </div>
          <div>
            <dt>Worst hour</dt>
            <dd>
              {worst ? formatGW(worst.error_mw, { signed: true }) : '—'}
              {worst && <small>{formatDateTime(worst.start_time)}</small>}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
