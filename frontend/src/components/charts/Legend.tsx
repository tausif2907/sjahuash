import styles from './Legend.module.css'

export interface LegendItem {
  label: string
  color: string
  kind: 'line' | 'dash' | 'rect' | 'band'
}

/** Legend keys mirror the mark: a stroke for lines, a swatch for bars and areas. */
export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <ul className={styles.legend}>
      {items.map((item) => (
        <li key={item.label} className={styles.item}>
          <span className={styles.key} data-kind={item.kind} style={{ color: item.color }} aria-hidden />
          {item.label}
        </li>
      ))}
    </ul>
  )
}
