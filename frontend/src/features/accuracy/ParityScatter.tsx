import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
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
import { formatDateTime, formatMW, gwTick } from '../../lib/format'

export interface ParityPoint {
  t: string
  forecast: number
  actual: number
  error: number
}

function renderTooltip(props: TooltipProps<ParityPoint>) {
  const p = rowOf(props)
  if (!p) return null
  return (
    <ChartTooltip
      title={formatDateTime(p.t)}
      rows={[
        { label: 'Forecast', value: formatMW(p.forecast), color: C.forecast },
        { label: 'Actual', value: formatMW(p.actual), color: C.actual },
        {
          label: 'Error',
          value: formatMW(p.error, { signed: true }),
          color: signColor(p.error),
          kind: 'rect',
        },
      ]}
    />
  )
}

interface DotProps {
  cx?: number
  cy?: number
  payload?: ParityPoint
}

const Dot = ({ cx = 0, cy = 0, payload }: DotProps) => (
  <circle cx={cx} cy={cy} r={3.5} fill={signColor(payload?.error)} fillOpacity={0.55} />
)

/** Each hour as forecast (x) vs actual (y); points under the diagonal fell short. */
export function ParityScatter({ points }: { points: ParityPoint[] }) {
  const ticks = niceTicks(0, Math.max(1000, ...points.flatMap((p) => [p.forecast, p.actual])), 5)
  const max = ticks.at(-1)!
  return (
    <>
      <AxisUnit>Actual, GW</AxisUnit>
      <ResponsiveContainer width="100%" height={260}>
        <ScatterChart margin={{ ...chartMargin, bottom: 18 }}>
          <CartesianGrid {...gridProps} vertical />
          <XAxis
            dataKey="forecast"
            type="number"
            domain={[0, max]}
            ticks={ticks}
            tickFormatter={gwTick}
            label={{
              value: 'Forecast, GW',
              position: 'insideBottomRight',
              offset: -14,
              fill: C.muted,
              fontSize: 11.5,
            }}
            {...axisProps}
          />
          <YAxis
            dataKey="actual"
            type="number"
            domain={[0, max]}
            ticks={ticks}
            tickFormatter={gwTick}
            {...yAxisProps}
          />
          <ReferenceLine
            segment={[
              { x: 0, y: 0 },
              { x: max, y: max },
            ]}
            stroke={C.axis}
            strokeWidth={1.5}
            label={{ value: 'Perfect forecast', position: 'insideTopLeft', fill: C.muted, fontSize: 11.5 }}
          />
          <Tooltip content={renderTooltip} cursor={false} isAnimationActive={false} />
          <Scatter data={points} shape={Dot} isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
    </>
  )
}
