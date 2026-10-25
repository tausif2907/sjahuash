import { useCallback, useEffect, useMemo, useState } from 'react'

import type { Meta, Selection, SeriesPoint } from '../../api/client'
import { useMetrics, useSeries } from '../../api/queries'
import { resolveGate, useAppState, type GateName } from '../../appState'
import { ChartCard } from '../../components/charts/ChartCard'
import { C } from '../../components/charts/chartTheme'
import { PageHeader, Toolbar, ToolbarGroup } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { DayStepper } from '../../components/ui/DayStepper'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { StatGrid, StatTile } from '../../components/ui/StatTile'
import { ErrorState, Skeleton } from '../../components/ui/States'
import { Switch } from '../../components/ui/Switch'
import type { Column } from '../../lib/csv'
import {
  addDays,
  clampDay,
  formatDateTime,
  formatDayLong,
  formatGW,
  formatGWh,
  formatHours,
  formatMW,
  formatPct,
  formatTime,
} from '../../lib/format'
import { dayEnergy, toChartPoints, worstShortfall } from '../../lib/series'
import styles from './DayAheadView.module.css'
import { DayCalendar } from './DayCalendar'
import { DayProfileChart } from './DayProfileChart'
import { DecisionTimeline } from './DecisionTimeline'
import { HourlyErrorChart } from './HourlyErrorChart'

const COLUMNS: Column<SeriesPoint>[] = [
  {
    key: 'time',
    label: 'Time (UK)',
    align: 'left',
    value: (p) => p.start_time,
    format: (p) => formatTime(p.start_time),
  },
  {
    key: 'actual',
    label: 'Actual (MW)',
    value: (p) => p.actual_mw,
    format: (p) => formatMW(p.actual_mw),
  },
  {
    key: 'forecast',
    label: 'Forecast (MW)',
    value: (p) => p.forecast_mw,
    format: (p) => formatMW(p.forecast_mw),
  },
  {
    key: 'error',
    label: 'Error (MW)',
    value: (p) => p.error_mw,
    format: (p) => formatMW(p.error_mw, { signed: true }),
  },
  {
    key: 'published',
    label: 'Forecast published',
    value: (p) => p.publish_time,
    format: (p) => (p.publish_time ? formatDateTime(p.publish_time) : '—'),
  },
  {
    key: 'horizon',
    label: 'Horizon',
    value: (p) => p.horizon_h,
    format: (p) => formatHours(p.horizon_h),
  },
]

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && !!el.closest('input, select, textarea, [role="radiogroup"]')

export function DayAheadView({ meta }: { meta: Meta }) {
  const [state, setState] = useAppState()
  const day = clampDay(state.day || meta.last_day, meta.first_day, meta.last_day)
  const gate = resolveGate(meta, state.gate)
  const [showBand, setShowBand] = useState(true)

  const daySelection = useMemo<Selection>(
    () => ({ start: day, end: day, mode: 'decision', gateClosure: gate.time }),
    [day, gate.time],
  )
  const monthSelection = useMemo<Selection>(
    () => ({
      start: meta.first_day,
      end: meta.last_day,
      mode: 'decision',
      gateClosure: gate.time,
    }),
    [meta.first_day, meta.last_day, gate.time],
  )
  const series = useSeries(daySelection)
  const month = useMetrics(monthSelection)

  const setDay = useCallback((d: string) => setState({ day: d }), [setState])

  // Left/right arrows step through delivery days.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || isTyping(e.target)) return
      if (e.key === 'ArrowLeft' && day > meta.first_day) setDay(addDays(day, -1))
      if (e.key === 'ArrowRight' && day < meta.last_day) setDay(addDays(day, 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [day, meta.first_day, meta.last_day, setDay])

  const points = useMemo(() => series.data?.points ?? [], [series.data])
  const overall = month.data?.overall
  const p10 = overall?.p10_mw
  const p90 = overall?.p90_mw
  const chartPoints = useMemo(
    () => toChartPoints(points, p10 != null && p90 != null ? { p10, p90 } : null),
    [points, p10, p90],
  )

  const energy = dayEnergy(points)
  const worst = worstShortfall(points)
  const worstPoint = worst ? (chartPoints.find((p) => p.t === Date.parse(worst.start_time)) ?? null) : null
  const dayStats = month.data?.by_day.find((d) => d.delivery_day === day)
  const forecastHours = points.filter((p) => p.forecast_mw != null)
  const horizons = forecastHours.map((p) => p.horizon_h ?? 0)
  const publishTime = forecastHours[0]?.publish_time ?? null
  const busy = series.isPlaceholderData || series.isFetching

  return (
    <>
      <PageHeader eyebrow="Day-ahead view" title={formatDayLong(day)}>
        What the trading desk could see at the {gate.name} gate closure, {gate.time} the day before delivery,
        set against what the wind actually did.
      </PageHeader>

      <Toolbar>
        <ToolbarGroup label="Delivery day">
          <DayStepper value={day} first={meta.first_day} last={meta.last_day} onChange={setDay} />
        </ToolbarGroup>
        <ToolbarGroup label="Decision deadline (D−1)">
          <SegmentedControl<GateName>
            label="Decision deadline"
            value={gate.name}
            onChange={(g) => setState({ gate: g })}
            options={[
              {
                value: 'EPEX',
                label: 'EPEX · 09:20',
                title: 'EPEX SPOT GB day-ahead auction',
              },
              {
                value: 'N2EX',
                label: 'N2EX · 09:50',
                title: 'Nord Pool N2EX GB day-ahead auction',
              },
            ]}
          />
        </ToolbarGroup>
        <ToolbarGroup label="Display">
          <Switch label="Error band (P10–P90)" checked={showBand} onChange={setShowBand} />
        </ToolbarGroup>
        <p className={styles.hint}>
          <kbd>←</kbd> <kbd>→</kbd> step through days
        </p>
      </Toolbar>

      <div className={styles.stack}>
        <Card
          title="Month at a glance"
          subtitle="Daily forecast bias at the decision deadline. Select a day to inspect it."
          busy={month.isFetching}
        >
          {month.isError ? (
            <ErrorState message={month.error.message} onRetry={() => month.refetch()} />
          ) : month.data ? (
            <DayCalendar days={month.data.by_day} selected={day} onSelect={setDay} />
          ) : (
            <Skeleton height={96} />
          )}
        </Card>

        {series.isError ? (
          <ErrorState message={series.error.message} onRetry={() => series.refetch()} />
        ) : !series.data ? (
          <Skeleton height={520} />
        ) : (
          <>
            <StatGrid columns={5}>
              <StatTile
                label="Forecast at deadline"
                value={formatGWh(energy.forecastGWh)}
                detail={
                  publishTime ? `Run published ${formatDateTime(publishTime)}` : 'No forecast available'
                }
                info="Wind energy expected over the day by the latest forecast run published before gate closure."
              />
              <StatTile
                label="Actual generation"
                value={formatGWh(energy.actualGWh)}
                detail="Metered outturn, same hours"
                info="Measured national wind output (Elexon FUELHH) over the hours the forecast covers."
              />
              <StatTile
                label="Energy gap"
                value={formatGWh(energy.gapGWh, { signed: true })}
                tone={energy.gapGWh < 0 ? 'shortfall' : 'surplus'}
                detail={`${formatPct(energy.gapPct, { signed: true })} vs forecast`}
                info="Actual minus forecast energy. Negative means the desk would have had to buy the shortfall elsewhere."
              />
              <StatTile
                label="Mean absolute error"
                value={formatGW(dayStats?.mae_mw)}
                detail={`Month: ${formatGW(overall?.mae_mw)}`}
                info="Average size of the hourly miss, ignoring direction."
              />
              <StatTile
                label="Worst hour"
                value={worst ? formatGW(worst.error_mw, { signed: true }) : 'None'}
                tone={worst ? 'shortfall' : 'neutral'}
                detail={
                  worst
                    ? `${formatTime(worst.start_time)} hour, less wind than forecast`
                    : 'No hour fell short'
                }
                info="The single hour where actual wind fell furthest below the forecast."
              />
            </StatGrid>

            <ChartCard
              title="Generation profile"
              subtitle="Half-hourly actual output against the hourly forecast available at the deadline"
              legend={[
                { label: 'Actual', color: C.actual, kind: 'line' },
                {
                  label: 'Forecast at deadline',
                  color: C.forecast,
                  kind: 'dash',
                },
                ...(showBand
                  ? [
                      {
                        label: 'Historical P10–P90 range',
                        color: C.band,
                        kind: 'band' as const,
                      },
                    ]
                  : []),
              ]}
              columns={COLUMNS}
              rows={points}
              filename={`wind-${day}-${gate.name}.csv`}
              busy={busy}
              footer="Band: forecast plus the 10th to 90th percentile of this month's day-ahead errors. 80% of hours fell inside it. Lower panel: hourly error, actual minus forecast."
            >
              <DayProfileChart points={chartPoints} showBand={showBand} worst={worstPoint} />
              <div className={styles.divider} />
              <HourlyErrorChart points={chartPoints} />
            </ChartCard>

            <Card title="How this forecast was chosen" busy={busy}>
              {points[0] && (
                <DecisionTimeline
                  day={day}
                  publishTime={publishTime}
                  cutoff={points[0].cutoff}
                  gateName={gate.name}
                  minHorizon={horizons.length ? Math.min(...horizons) : null}
                  maxHorizon={horizons.length ? Math.max(...horizons) : null}
                />
              )}
            </Card>
          </>
        )}
      </div>
    </>
  )
}
