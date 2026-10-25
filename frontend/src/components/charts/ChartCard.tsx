import { Download } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { downloadCsv, type Column } from '../../lib/csv'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { SegmentedControl } from '../ui/SegmentedControl'
import { DataTable } from './DataTable'
import { Legend, type LegendItem } from './Legend'

interface ChartCardProps<Row> {
  title: ReactNode
  subtitle?: ReactNode
  legend?: LegendItem[]
  columns: Column<Row>[]
  rows: Row[]
  filename: string
  busy?: boolean
  footer?: ReactNode
  className?: string
  children: ReactNode
}

/** Every chart has a table twin (accessible, exact values) and a CSV export. */
export function ChartCard<Row>({
  title,
  subtitle,
  legend,
  columns,
  rows,
  filename,
  busy,
  footer,
  className,
  children,
}: ChartCardProps<Row>) {
  const [view, setView] = useState<'chart' | 'table'>('chart')
  return (
    <Card
      title={title}
      subtitle={subtitle}
      busy={busy}
      footer={footer}
      className={className}
      actions={
        <>
          <SegmentedControl
            size="sm"
            label="Display as"
            value={view}
            onChange={setView}
            options={[
              { value: 'chart', label: 'Chart' },
              { value: 'table', label: 'Table' },
            ]}
          />
          <Button
            size="sm"
            variant="ghost"
            iconOnly
            icon={<Download size={15} />}
            aria-label="Download CSV"
            title="Download CSV"
            onClick={() => downloadCsv(filename, columns, rows)}
            disabled={!rows.length}
          />
        </>
      }
    >
      {view === 'chart' ? (
        <>
          {legend && <Legend items={legend} />}
          {children}
        </>
      ) : (
        <DataTable columns={columns} rows={rows} />
      )}
    </Card>
  )
}
