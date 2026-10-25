import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
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
  yAxisProps,
} from '../../components/charts/chartTheme'
import { formatDateTime, formatGW, formatHours, formatMW, formatTime, gwTick } from '../../lib/format'
import type { ChartPoint } from '../../lib/series'
import { dayAxis, HALF_HOUR } from './dayAxis'

function renderTooltip(props: TooltipProps<ChartPoint>) {
  const p = rowOf(props)
  if (!p) return null
  return (
    <ChartTooltip
      title={`${formatTime(p.t)}–${formatTime(p.t + HALF_HOUR)}`}
      rows={[
        { label: 'Actual', value: formatMW(p.actual), color: C.actual },
        ...(p.forecast != null
          ? [
              {
                label: 'Forecast',
                value: formatMW(p.forecast),
                color: C.forecast,
                kind: 'dash' as const,
              },
              { label: 'Error', value: formatMW(p.error, { signed: true }) },
            ]
          : []),
        ...(p.band
          ? [
              {
                label: 'P10–P90 range',
                value: `${formatGW(p.band[0], { digits: 1 })} – ${formatGW(p.band[1], { digits: 1 })}`,
              },
            ]
          : []),
      ]}
      note={
        p.publishTime
          ? `Forecast published ${formatDateTime(p.publishTime)} (${formatHours(p.horizonH)} ahead)`
          : 'Forecasts are hourly; this half-hour has an actual only.'
      }
    />
  )
}

interface DayProfileChartProps {
  points: ChartPoint[]
  showBand: boolean
  worst: ChartPoint | null
}

export function DayProfileChart({ points, showBand, worst }: DayProfileChartProps) {
  const { domain, ticks } = dayAxis(points)
  const yTicks = niceTicks(
    0,
    Math.max(
      1000,
      ...points.flatMap((p) => [p.actual ?? 0, p.forecast ?? 0, showBand && p.band ? p.band[1] : 0]),
    ),
  )

  return (
    <>
      <AxisUnit>GW</AxisUnit>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={points} margin={chartMargin} syncId="day-profile">
          <CartesianGrid {...gridProps} />
          <XAxis
            dataKey="t"
            type="number"
            domain={domain}
            ticks={ticks}
            tickFormatter={formatTime}
            {...axisProps}
          />
          <YAxis domain={[0, yTicks.at(-1)!]} ticks={yTicks} tickFormatter={gwTick} {...yAxisProps} />
          <Tooltip
            content={renderTooltip}
            cursor={{ stroke: C.axis, strokeWidth: 1 }}
            isAnimationActive={false}
          />
          {showBand && (
            <Area
              dataKey="band"
              stroke="none"
              fill={C.band}
              fillOpacity={1}
              connectNulls
              activeDot={false}
              isAnimationActive={false}
            />
          )}
          <Line
            dataKey="forecast"
            stroke={C.forecast}
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            connectNulls
            activeDot={{
              r: 4,
              fill: C.forecast,
              stroke: C.surface,
              strokeWidth: 2,
            }}
            animationDuration={500}
          />
          <Line
            dataKey="actual"
            type="monotone"
            stroke={C.actual}
            strokeWidth={2}
            dot={false}
            activeDot={{
              r: 4,
              fill: C.actual,
              stroke: C.surface,
              strokeWidth: 2,
            }}
            animationDuration={500}
          />
          {worst?.actual != null && (
            <ReferenceDot
              x={worst.t}
              y={worst.actual}
              r={5}
              fill={C.shortfall}
              stroke={C.surface}
              strokeWidth={2}
              label={{
                value: `Largest shortfall ${formatGW(worst.error, { signed: true })}`,
                position: 'bottom',
                offset: 10,
                fill: C.ink,
                fontSize: 12,
                fontWeight: 600,
              }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </>
  )
}
