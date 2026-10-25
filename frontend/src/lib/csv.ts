export interface Column<Row> {
  key: string
  label: string
  value: (row: Row) => string | number | null | undefined
  /** Display formatting for the on-screen table; the CSV keeps raw values. */
  format?: (row: Row) => string
  align?: 'left' | 'right'
}

const escape = (v: string | number | null | undefined) => {
  if (v == null) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv<Row>(columns: Column<Row>[], rows: Row[]): string {
  const header = columns.map((c) => escape(c.label)).join(',')
  const body = rows.map((r) => columns.map((c) => escape(c.value(r))).join(','))
  return [header, ...body].join('\n')
}

export function downloadCsv<Row>(filename: string, columns: Column<Row>[], rows: Row[]) {
  const blob = new Blob([toCsv(columns, rows)], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
