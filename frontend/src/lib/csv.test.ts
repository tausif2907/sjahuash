import { describe, expect, it } from 'vitest'

import { toCsv, type Column } from './csv'

interface Row {
  name: string
  value: number | null
}

const columns: Column<Row>[] = [
  { key: 'name', label: 'Name', value: (r) => r.name },
  { key: 'value', label: 'Value (MW)', value: (r) => r.value },
]

describe('toCsv', () => {
  it('writes a header and raw values', () => {
    expect(toCsv(columns, [{ name: 'a', value: 1 }])).toBe('Name,Value (MW)\na,1')
  })

  it('quotes commas, quotes and newlines; leaves nulls empty', () => {
    expect(toCsv(columns, [{ name: 'x, "y"\nz', value: null }])).toBe('Name,Value (MW)\n"x, ""y""\nz",')
  })
})
