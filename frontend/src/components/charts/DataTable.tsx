import type { Column } from '../../lib/csv'
import { DASH } from '../../lib/format'
import styles from './DataTable.module.css'

export function DataTable<Row>({ columns, rows }: { columns: Column<Row>[]; rows: Row[] }) {
  return (
    <div className={styles.scroller} tabIndex={0} role="region" aria-label="Data table">
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} data-align={c.align ?? 'right'} scope="col">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.key} data-align={c.align ?? 'right'}>
                  {c.format ? c.format(row) : (c.value(row) ?? DASH)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
