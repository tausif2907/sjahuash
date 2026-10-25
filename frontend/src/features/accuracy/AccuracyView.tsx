import { useMemo, useState } from 'react'

import type { DayStats, Meta, Mode, Selection } from '../../api/client'
import { useHorizonProfile, useMetrics, useSeries } from '../../api/queries'
import { resolveGate, resolveRange, useAppState, type GateName } from '../../appState'
import { ChartCard } from '../../components/charts/ChartCard'
import { PageHeader, Toolbar, ToolbarGroup } from '../../components/layout/PageHeader'
import { DateRange } from '../../components/ui/DateRange'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { Slider } from '../../components/ui/Slider'
import { StatGrid, StatTile } from '../../components/ui/StatTile'
import { ErrorState, Skeleton } from '../../components/ui/States'
import type { Column } from '../../lib/csv'
import {
  formatCount,
  formatDateTime,
  formatDay,
  formatDayCompact,
  formatGW,
  formatHours,
  formatMW,
  formatPct,
} from '../../lib/format'
import { errorsOf, histogram, worstShortfall } from '../../lib/series'
import { useDebouncedCallback } from '../../lib/useDebounced'
import styles from './AccuracyView.module.css'
import { DailyErrorChart } from './DailyErrorChart'
import { ErrorHistogram, type HistogramRow } from './ErrorHistogram'
import { ErrorProfileChart, type ProfileRow } from './ErrorProfileChart'
import { InsightBanner } from './InsightBanner'
import { dailyLegend, profileLegend, signLegend } from './legends'
import { ParityScatter, type ParityPoint } from './ParityScatter'

const MAX_H = 48
const clampHorizon = (v: number) => (Number.isFinite(v) ? Math.min(MAX_H, Math.max(0, Math.round(v))) : 24)
const clock = (hour: number) => `${String(hour).padStart(2, '0')}:00`

const profileColumns = (xLabel: string, x: (r: ProfileRow) => string): Column<ProfileRow>[] => [
  { key: 'x', label: xLabel, align: 'left', value: (r) => r.x, format: x },
  { key: 'mae', label: 'MAE (MW)', value: (r) => r.mae, format: (r) => formatMW(r.mae) },
  {
    key: 'bias',
    label: 'Bias (MW)',
    value: (r) => r.bias,
    format: (r) => formatMW(r.bias, { signed: true }),
  },
  {
    key: 'p10',
    label: 'P10 (MW)',
    value: (r) => r.band?.[0],
    format: (r) => formatMW(r.band?.[0], { signed: true }),
  },
  {
    key: 'p90',
    label: 'P90 (MW)',
    value: (r) => r.band?.[1],
    format: (r) => formatMW(r.band?.[1], { signed: true }),
  },
  { key: 'count', label: 'Hours', value: (r) => r.count, format: (r) => formatCount(r.count) },
]

const histogramColumns: Column<HistogramRow>[] = [
  {
    key: 'from',
    label: 'Error from (MW)',
    align: 'left',
    value: (r) => r.x0,
    format: (r) => formatMW(r.x0, { signed: true }),
  },
  { key: 'to', label: 'Error to (MW)', value: (r) => r.x1, format: (r) => formatMW(r.x1, { signed: true }) },
  { key: 'count', label: 'Hours', value: (r) => r.count, format: (r) => formatCount(r.count) },
  { key: 'pct', label: 'Share', value: (r) => r.pct.toFixed(2), format: (r) => formatPct(r.pct) },
]

const parityColumns: Column<ParityPoint>[] = [
  { key: 't', label: 'Hour (UK)', align: 'left', value: (p) => p.t, format: (p) => formatDateTime(p.t) },
  { key: 'forecast', label: 'Forecast (MW)', value: (p) => p.forecast, format: (p) => formatMW(p.forecast) },
  { key: 'actual', label: 'Actual (MW)', value: (p) => p.actual, format: (p) => formatMW(p.actual) },
  {
    key: 'error',
    label: 'Error (MW)',
    value: (p) => p.error,
    format: (p) => formatMW(p.error, { signed: true }),
  },
]

const dailyColumns: Column<DayStats>[] = [
  {
    key: 'day',
    label: 'Delivery day',
    align: 'left',
    value: (d) => d.delivery_day,
    format: (d) => formatDay(d.delivery_day),
  },
  {
    key: 'bias',
    label: 'Bias (MW)',
    value: (d) => d.bias_mw,
    format: (d) => formatMW(d.bias_mw, { signed: true }),
  },
  { key: 'mae', label: 'MAE (MW)', value: (d) => d.mae_mw, format: (d) => formatMW(d.mae_mw) },
  { key: 'rmse', label: 'RMSE (MW)', value: (d) => d.rmse_mw, format: (d) => formatMW(d.rmse_mw) },
  {
    key: 'worst',
    label: 'Worst shortfall (MW)',
    value: (d) => d.worst_shortfall_mw,
    format: (d) => formatMW(d.worst_shortfall_mw),
  },
]

interface StatsLike {
  mae_mw?: number | null
  bias_mw?: number | null
  p10_mw?: number | null
  p90_mw?: number | null
  count: number
}

const toProfileRow = (x: number, s: StatsLike): ProfileRow => ({
  x,
  mae: s.mae_mw ?? null,
  bias: s.bias_mw ?? null,
  band: s.p10_mw != null && s.p90_mw != null ? [s.p10_mw, s.p90_mw] : null,
  count: s.count,
})

export function AccuracyView({ meta }: { meta: Meta }) {
  const [state, setState] = useAppState()
  const { start, end } = resolveRange(meta, state.from, state.to)
  const gate = resolveGate(meta, state.gate)
  const mode: Mode = state.mode === 'horizon' ? 'horizon' : 'decision'
  const horizon = clampHorizon(Number(state.h))

  // The slider moves instantly; the query follows once dragging pauses.
  const [draftHorizon, setDraftHorizon] = useState<number | null>(null)
  const commitHorizon = useDebouncedCallback((h: number) => {
    setState({ h: String(h) })
    setDraftHorizon(null)
  })

  const selection = useMemo<Selection>(
    () =>
      mode === 'decision'
        ? { start, end, mode, gateClosure: gate.time }
        : { start, end, mode, horizonH: horizon },
    [start, end, mode, gate.time, horizon],
  )
  const metrics = useMetrics(selection)
  const series = useSeries(selection)
  const profile = useHorizonProfile(start, end)

  const points = useMemo(() => series.data?.points ?? [], [series.data])
  const errors = useMemo(() => errorsOf(points), [points])
  const worst = useMemo(() => worstShortfall(points), [points])
  const histRows = useMemo<HistogramRow[]>(
    () => histogram(errors, 500).map((b) => ({ ...b, pct: b.share * 100 })),
    [errors],
  )
  const parity = useMemo<ParityPoint[]>(
    () =>
      points.flatMap((p) =>
        p.forecast_mw != null && p.actual_mw != null
          ? [{ t: p.start_time, forecast: p.forecast_mw, actual: p.actual_mw, error: p.error_mw ?? 0 }]
          : [],
      ),
    [points],
  )
  const horizonRows = useMemo(
    () => profile.data?.horizons.map((r) => toProfileRow(r.horizon_h, r)) ?? [],
    [profile.data],
  )
  const hourRows = useMemo(
    () => metrics.data?.by_hour.map((r) => toProfileRow(r.hour, r)) ?? [],
    [metrics.data],
  )

  const overall = metrics.data?.overall
  const gateHours = Number(gate.time.slice(0, 2)) + Number(gate.time.slice(3)) / 60
  const windowFrom = Math.round((24 - gateHours) * 10) / 10
  const windowTo = Math.round((48 - gateHours) * 10) / 10
  const context =
    mode === 'decision'
      ? `at the ${gate.name} gate closure (${gate.time} on D−1)`
      : `${formatHours(horizon)} ahead`
  const busy =
    metrics.isPlaceholderData || series.isPlaceholderData || metrics.isFetching || series.isFetching

  const openDay = (day: string) => setState({ view: 'day', day }, { push: true })
  const selectHorizon = (h: number) => {
    setState({ mode: 'horizon', h: String(clampHorizon(h)) })
    setDraftHorizon(null)
  }

  return (
    <>
      <PageHeader eyebrow="Forecast accuracy" title="How far can the forecast be trusted?">
        Measured error of the wind forecasts the desk would have relied on, {formatDayCompact(start)} to{' '}
        {formatDayCompact(end)} 2026. Error is actual minus forecast, so negative means less wind than
        forecast.
      </PageHeader>

      <Toolbar>
        <ToolbarGroup label="Period">
          <DateRange
            start={start}
            end={end}
            first={meta.first_day}
            last={meta.last_day}
            onChange={(from, to) => setState({ from, to })}
          />
        </ToolbarGroup>
        <ToolbarGroup label="Forecast taken">
          <SegmentedControl<Mode>
            label="Which forecast to evaluate"
            value={mode}
            onChange={(m) => setState({ mode: m })}
            options={[
              {
                value: 'decision',
                label: 'At gate closure',
                title: 'The forecast available at the day-ahead deadline',
              },
              {
                value: 'horizon',
                label: 'Fixed look-ahead',
                title: 'The forecast available a set number of hours ahead',
              },
            ]}
          />
        </ToolbarGroup>
        {mode === 'decision' ? (
          <ToolbarGroup label="Deadline (D−1)">
            <SegmentedControl<GateName>
              label="Decision deadline"
              value={gate.name}
              onChange={(g) => setState({ gate: g })}
              options={[
                { value: 'EPEX', label: 'EPEX · 09:20' },
                { value: 'N2EX', label: 'N2EX · 09:50' },
              ]}
            />
          </ToolbarGroup>
        ) : (
          <ToolbarGroup label="Look-ahead">
            <Slider
              label="Hours ahead"
              value={draftHorizon ?? horizon}
              min={0}
              max={MAX_H}
              onChange={(h) => {
                setDraftHorizon(h)
                commitHorizon(h)
              }}
              format={(h) => `${h} h`}
            />
          </ToolbarGroup>
        )}
      </Toolbar>

      {metrics.isError || series.isError ? (
        <ErrorState
          message={(metrics.error ?? series.error)?.message ?? 'Unknown error'}
          onRetry={() => {
            void metrics.refetch()
            void series.refetch()
          }}
        />
      ) : !overall || !series.data ? (
        <Skeleton height={640} />
      ) : (
        <div className={styles.stack}>
          <InsightBanner overall={overall} errors={errors} worst={worst} context={context} />

          <StatGrid columns={6}>
            <StatTile
              label="Mean absolute error"
              value={formatGW(overall.mae_mw)}
              detail={`${formatPct(overall.nmae_pct)} of actual output (nMAE)`}
              info="Average size of the hourly miss, ignoring direction. nMAE divides total absolute error by total actual output."
            />
            <StatTile
              label="RMSE"
              value={formatGW(overall.rmse_mw)}
              detail="Penalises large misses more"
              info="Root mean squared error. Higher than MAE when a few hours miss badly."
            />
            <StatTile
              label="Bias"
              value={formatGW(overall.bias_mw, { signed: true })}
              tone={(overall.bias_mw ?? 0) < 0 ? 'shortfall' : 'surplus'}
              detail={(overall.bias_mw ?? 0) < 0 ? 'Forecast runs high' : 'Forecast runs low'}
              info="Mean of actual minus forecast. Negative means the forecast promised more wind than arrived."
            />
            <StatTile
              label="P10 error"
              value={formatGW(overall.p10_mw, { signed: true })}
              tone="shortfall"
              detail="9 in 10 hours did better than this"
              info="10th percentile of actual minus forecast. Its size is the cover that absorbs the shortfall in 90% of hours."
            />
            <StatTile
              label="Worst shortfall"
              value={formatGW(overall.worst_shortfall_mw)}
              detail={worst ? formatDateTime(worst.start_time) : undefined}
              info="The single largest gap where actual wind fell below the forecast."
            />
            <StatTile
              label="Hours evaluated"
              value={formatCount(overall.count)}
              detail={
                mode === 'decision'
                  ? `Gate closure ${gate.time}, D−1`
                  : `Forecasts ${formatHours(horizon)} ahead`
              }
              info="Hourly target times with both a forecast and an actual in the selected period."
            />
          </StatGrid>

          <ChartCard
            title="Error by forecast look-ahead"
            subtitle="Each target hour scored with the latest forecast available 0 to 48 hours before it. Click to evaluate a look-ahead."
            legend={profileLegend}
            columns={profileColumns('Look-ahead', (r) => formatHours(r.x))}
            rows={horizonRows}
            filename={`error-by-horizon-${start}-${end}.csv`}
            busy={profile.isPlaceholderData || profile.isFetching}
            footer={`Shaded: the look-aheads a day-ahead trade relies on. Delivery hours fall ${formatHours(windowFrom)} to ${formatHours(windowTo)} after the ${gate.time} deadline.`}
          >
            {profile.data ? (
              <ErrorProfileChart
                rows={horizonRows}
                xTicks={[0, 6, 12, 18, 24, 30, 36, 42, 48]}
                xFormat={(x) => `${x} h`}
                tooltipTitle={(x) => `${x} h ahead`}
                highlight={{ x1: windowFrom, x2: windowTo, label: 'Day-ahead window' }}
                selected={mode === 'horizon' ? (draftHorizon ?? horizon) : null}
                onSelect={selectHorizon}
              />
            ) : (
              <Skeleton height={280} />
            )}
          </ChartCard>

          <div className={styles.grid}>
            <ChartCard
              title="Distribution of errors"
              subtitle="How often each size of miss occurred, in 0.5 GW bins"
              legend={signLegend}
              columns={histogramColumns}
              rows={histRows}
              filename={`error-distribution-${start}-${end}.csv`}
              busy={busy}
            >
              <ErrorHistogram
                rows={histRows}
                p10={overall.p10_mw}
                p50={overall.p50_mw}
                p90={overall.p90_mw}
              />
            </ChartCard>

            <ChartCard
              title="Forecast vs actual"
              subtitle="One dot per hour. Dots below the diagonal fell short of the forecast."
              columns={parityColumns}
              rows={parity}
              filename={`forecast-vs-actual-${start}-${end}.csv`}
              busy={busy}
            >
              <ParityScatter points={parity} />
            </ChartCard>

            <ChartCard
              title="Error by time of day"
              subtitle="Statistics for each UK clock hour of the target"
              legend={profileLegend}
              columns={profileColumns('Hour (UK)', (r) => clock(r.x))}
              rows={hourRows}
              filename={`error-by-hour-${start}-${end}.csv`}
              busy={busy}
            >
              <ErrorProfileChart
                rows={hourRows}
                xTicks={[0, 3, 6, 9, 12, 15, 18, 21, 23]}
                xFormat={clock}
                tooltipTitle={(x) => `${clock(x)} hour`}
                height={260}
              />
            </ChartCard>

            <ChartCard
              title="Error by delivery day"
              subtitle="Daily bias and mean absolute error. Click a day to open it."
              legend={dailyLegend}
              columns={dailyColumns}
              rows={metrics.data?.by_day ?? []}
              filename={`error-by-day-${start}-${end}.csv`}
              busy={busy}
            >
              <DailyErrorChart days={metrics.data?.by_day ?? []} onOpenDay={openDay} />
            </ChartCard>
          </div>
        </div>
      )}
    </>
  )
}
