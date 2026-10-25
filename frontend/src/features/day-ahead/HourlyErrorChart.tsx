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
import { formatMW, formatTime, gwTick } from '../../lib/format'
import { symmetricExtent, type ChartPoint } from '../../lib/series'
import { dayAxis } from './dayAxis'

function renderTooltip(props: TooltipProps<ChartPoint>) {
  const p = rowOf(props)
  if (!p || p.error == null) return null
  return (
    <ChartTooltip
      title={`${formatTime(p.t)} hour`}
      rows={[
        {
          label: p.error < 0 ? 'less wind than forecast' : 'more wind than forecast',
          value: formatMW(p.error, { signed: true }),
          color: signColor(p.error),
          kind: 'rect',
        },
      ]}
    />
  )
}

/** Hourly forecast error under the profile chart; same x-axis, synced tooltip. */
export function HourlyErrorChart({ points }: { points: ChartPoint[] }) {
  const { domain, ticks } = dayAxis(points)
  const extent = symmetricExtent(
    points.flatMap((p) => (p.error == null ? [] : [p.error])),
    1000,
  )
  const yTicks = niceTicks(-extent, extent, 4)
  return (
    <>
      <AxisUnit>Error, GW (actual − forecast)</AxisUnit>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={points} margin={chartMargin} syncId="day-profile" barCategoryGap="12%">
          <CartesianGrid {...gridProps} />
          <XAxis
            dataKey="t"
            type="number"
            domain={domain}
            ticks={ticks}
            tickFormatter={formatTime}
            {...axisProps}
          />
          <YAxis domain={[yTicks[0], yTicks.at(-1)!]} ticks={yTicks} tickFormatter={gwTick} {...yAxisProps} />
          <ReferenceLine y={0} stroke={C.axis} />
          <Tooltip content={renderTooltip} cursor={{ fill: C.accentWash }} isAnimationActive={false} />
          <Bar dataKey="error" shape={signedBarShape('error')} maxBarSize={24} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </>
  )
}
