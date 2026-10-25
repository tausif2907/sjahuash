import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'

import { InfoTip } from './InfoTip'
import styles from './StatTile.module.css'

export type Tone = 'neutral' | 'shortfall' | 'surplus'

interface StatTileProps {
  label: string
  value: string
  detail?: ReactNode
  info?: string
  /** Direction cue for signed values; always shown with an icon, never colour alone. */
  tone?: Tone
}

export function StatTile({ label, value, detail, info, tone = 'neutral' }: StatTileProps) {
  return (
    <div className={styles.tile}>
      <div className={styles.label}>
        <span>{label}</span>
        {info && <InfoTip text={info} label={`About ${label}`} />}
      </div>
      <div className={styles.value}>
        {tone !== 'neutral' && (
          <span className={styles.cue} data-tone={tone} aria-hidden>
            {tone === 'shortfall' ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
          </span>
        )}
        {value}
      </div>
      {detail && <div className={styles.detail}>{detail}</div>}
    </div>
  )
}

/** Fixed column counts per breakpoint, so a row of tiles never leaves an orphan. */
export function StatGrid({ columns, children }: { columns: 5 | 6; children: ReactNode }) {
  return (
    <div className={styles.grid} data-cols={columns}>
      {children}
    </div>
  )
}
