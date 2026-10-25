import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { DayStats } from '../../api/client'
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
import { dayOfMonth, formatDay, formatGW, gwTick } from '../../lib/format'

function renderTooltip(props: TooltipProps<DayStats>) {
  const d = rowOf(props)
  if (!d) return null
  return (
    <ChartTooltip
      title={formatDay(d.delivery_day)}
      rows={[
        {
          label: 'Bias',
          value: formatGW(d.bias_mw, { signed: true }),
          color: signColor(d.bias_mw),
          kind: 'rect',
        },
        { label: 'Mean absolute error', value: formatGW(d.mae_mw), color: C.neutral },
        { label: 'Worst shortfall', value: formatGW(d.worst_shortfall_mw) },
      ]}
      note="Click to open this day"
    />
  )
}

/** Bias per delivery day with MAE overlaid; clicking a day opens it in the day-ahead view. */
export function DailyErrorChart({ days, onOpenDay }: { days: DayStats[]; onOpenDay: (day: string) => void }) {
  const values = days.flatMap((d) => [d.bias_mw ?? 0, d.mae_mw ?? 0])
  const yTicks = niceTicks(Math.min(0, ...values), Math.max(0, ...values))
  return (
    <>
      <AxisUnit>GW</AxisUnit>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart
          data={days}
          margin={chartMargin}
          style={{ cursor: 'pointer' }}
          onClick={(state) => {
            const label = state?.activeLabel
            if (typeof label === 'string') onOpenDay(label)
          }}
        >
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="delivery_day" tickFormatter={(d: string) => String(dayOfMonth(d))} {...axisProps} />
          <YAxis domain={[yTicks[0], yTicks.at(-1)!]} ticks={yTicks} tickFormatter={gwTick} {...yAxisProps} />
          <ReferenceLine y={0} stroke={C.axis} />
          <Tooltip content={renderTooltip} cursor={{ fill: C.accentWash }} isAnimationActive={false} />
          <Bar
            dataKey="bias_mw"
            shape={signedBarShape('bias_mw')}
            maxBarSize={24}
            isAnimationActive={false}
          />
          <Line
            dataKey="mae_mw"
            stroke={C.neutral}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: C.neutral, stroke: C.surface, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </>
  )
}
