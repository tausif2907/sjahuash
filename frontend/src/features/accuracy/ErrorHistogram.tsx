import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { AxisUnit } from '../../components/charts/AxisUnit'
import { ChartTooltip } from '../../components/charts/ChartTooltip'
import { rowOf, type TooltipProps } from '../../components/charts/tooltip'
import {
  axisProps,
  C,
  chartMargin,
  gridProps,
  niceTicks,
  signColor,
  yAxisProps,
} from '../../components/charts/chartTheme'
import { signedBarShape } from '../../components/charts/SignedBar'
import { formatCount, formatGW, formatPct, gwTick } from '../../lib/format'
import type { Bin } from '../../lib/series'

export interface HistogramRow extends Bin {
  pct: number
}

interface ErrorHistogramProps {
  rows: HistogramRow[]
  p10: number | null | undefined
  p50: number | null | undefined
  p90: number | null | undefined
}

function renderTooltip(props: TooltipProps<HistogramRow>) {
  const r = rowOf(props)
  if (!r) return null
  return (
    <ChartTooltip
      title={`${formatGW(r.x0, { signed: true, digits: 1 })} to ${formatGW(r.x1, { signed: true, digits: 1 })}`}
      rows={[
        { label: 'of hours', value: formatPct(r.pct), color: signColor(r.mid), kind: 'rect' },
        { label: 'hours', value: formatCount(r.count) },
      ]}
    />
  )
}

const marker = (value: number, label: string) => (
  <ReferenceLine
    x={value}
    stroke={C.ink}
    strokeWidth={1}
    label={{ value: label, position: 'top', fill: C.ink, fontSize: 11.5, fontWeight: 600 }}
  />
)

/** How often each size of error occurred, with the P10, median and P90 marked. */
export function ErrorHistogram({ rows, p10, p50, p90 }: ErrorHistogramProps) {
  if (!rows.length) return null
  const xTicks = niceTicks(rows[0].x0, rows.at(-1)!.x1, 6)
  const yTicks = niceTicks(0, Math.max(...rows.map((r) => r.pct)), 4)
  return (
    <>
      <AxisUnit>% of hours</AxisUnit>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={rows} margin={{ ...chartMargin, top: 22 }} barCategoryGap={2}>
          <CartesianGrid {...gridProps} />
          <XAxis
            dataKey="mid"
            type="number"
            domain={[xTicks[0], xTicks.at(-1)!]}
            ticks={xTicks}
            tickFormatter={(v: number) => `${gwTick(v)} GW`}
            {...axisProps}
          />
          <YAxis
            domain={[0, yTicks.at(-1)!]}
            ticks={yTicks}
            tickFormatter={(v: number) => `${v}`}
            {...yAxisProps}
          />
          <Tooltip content={renderTooltip} cursor={{ fill: C.accentWash }} isAnimationActive={false} />
          <Bar dataKey="pct" shape={signedBarShape('pct', 'mid')} maxBarSize={24} isAnimationActive={false} />
          <ReferenceLine x={0} stroke={C.axis} />
          {p10 != null && marker(p10, 'P10')}
          {p50 != null && marker(p50, 'Median')}
          {p90 != null && marker(p90, 'P90')}
        </BarChart>
      </ResponsiveContainer>
    </>
  )
}
