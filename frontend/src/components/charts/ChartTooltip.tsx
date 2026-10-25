import type { ReactNode } from 'react'

import styles from './ChartTooltip.module.css'

export interface TooltipRow {
  label: string
  value: string
  color?: string
  kind?: 'line' | 'dash' | 'rect'
}

/** Values lead, labels follow; rows are keyed by a short stroke of the series colour. */
export function ChartTooltip({ title, rows, note }: { title: string; rows: TooltipRow[]; note?: ReactNode }) {
  return (
    <div className={styles.tooltip}>
      <div className={styles.title}>{title}</div>
      <table className={styles.rows}>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td className={styles.keyCell}>
                {r.color && (
                  <span className={styles.key} data-kind={r.kind ?? 'line'} style={{ color: r.color }} />
                )}
              </td>
              <td className={styles.value}>{r.value}</td>
              <td className={styles.label}>{r.label}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {note && <div className={styles.note}>{note}</div>}
    </div>
  )
}
