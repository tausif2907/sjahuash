import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
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
  yAxisProps,
} from '../../components/charts/chartTheme'
import { formatCount, formatGW, gwTick } from '../../lib/format'

export interface ProfileRow {
  x: number
  mae: number | null
  bias: number | null
  band: [number, number] | null
  count: number
}

interface ErrorProfileChartProps {
  rows: ProfileRow[]
  xTicks: number[]
  xFormat: (x: number) => string
  tooltipTitle: (x: number) => string
  /** Shaded x-range with a label, e.g. the horizons day-ahead trades actually use. */
  highlight?: { x1: number; x2: number; label: string }
  selected?: number | null
  onSelect?: (x: number) => void
  height?: number
}

/** MAE, bias and the P10-P90 error range against one x dimension (horizon, hour of day). */
export function ErrorProfileChart({
  rows,
  xTicks,
  xFormat,
  tooltipTitle,
  highlight,
  selected,
  onSelect,
  height = 280,
}: ErrorProfileChartProps) {
  const values = rows.flatMap((r) => [r.mae ?? 0, r.band?.[0] ?? 0, r.band?.[1] ?? 0])
  const yTicks = niceTicks(Math.min(0, ...values), Math.max(0, ...values))

  const renderTooltip = (props: TooltipProps<ProfileRow>) => {
    const r = rowOf(props)
    if (!r) return null
    return (
      <ChartTooltip
        title={tooltipTitle(r.x)}
        rows={[
          { label: 'Mean absolute error', value: formatGW(r.mae), color: C.actual },
          { label: 'Bias', value: formatGW(r.bias, { signed: true }), color: C.forecast },
          {
            label: 'P10–P90',
            value: r.band
              ? `${formatGW(r.band[0], { signed: true, digits: 1 })} to ${formatGW(r.band[1], { signed: true, digits: 1 })}`
              : '—',
          },
          { label: 'hours evaluated', value: formatCount(r.count) },
        ]}
        note={onSelect ? 'Click to evaluate this horizon' : undefined}
      />
    )
  }

  return (
    <>
      <AxisUnit>GW</AxisUnit>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={rows}
          margin={chartMargin}
          onClick={(state) => {
            const x = Number(state?.activeLabel)
            if (onSelect && Number.isFinite(x)) onSelect(x)
          }}
          style={onSelect ? { cursor: 'pointer' } : undefined}
        >
          <CartesianGrid {...gridProps} />
          {highlight && (
            <ReferenceArea
              x1={highlight.x1}
              x2={highlight.x2}
              fill={C.accentWash}
              fillOpacity={0.6}
              stroke="none"
              label={{ value: highlight.label, position: 'insideTop', fill: C.ink, fontSize: 11.5 }}
            />
          )}
          <XAxis
            dataKey="x"
            type="number"
            domain={[xTicks[0], xTicks.at(-1)!]}
            ticks={xTicks}
            tickFormatter={xFormat}
            {...axisProps}
          />
          <YAxis domain={[yTicks[0], yTicks.at(-1)!]} ticks={yTicks} tickFormatter={gwTick} {...yAxisProps} />
          <ReferenceLine y={0} stroke={C.axis} />
          <Tooltip content={renderTooltip} cursor={{ stroke: C.axis }} isAnimationActive={false} />
          <Area
            dataKey="band"
            stroke="none"
            fill={C.band}
            fillOpacity={1}
            activeDot={false}
            isAnimationActive={false}
          />
          <Line
            dataKey="bias"
            stroke={C.forecast}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: C.forecast, stroke: C.surface, strokeWidth: 2 }}
            animationDuration={500}
          />
          <Line
            dataKey="mae"
            stroke={C.actual}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: C.actual, stroke: C.surface, strokeWidth: 2 }}
            animationDuration={500}
          />
          {selected != null && (
            <ReferenceLine
              x={selected}
              stroke={C.ink}
              strokeWidth={1.5}
              label={{
                value: `Selected: ${xFormat(selected)}`,
                position: 'insideTopRight',
                fill: C.ink,
                fontSize: 11.5,
              }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </>
  )
}
