import { Activity, CalendarCheck, Clock, Gavel, type LucideIcon } from 'lucide-react'

import type { Meta } from '../../api/client'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { formatClock, formatCount, formatDateTime, formatDayCompact, formatHours } from '../../lib/format'
import styles from './MethodologyView.module.css'

const REPO_URL = 'https://github.com/tausif2907/sjahuash'

const STEPS: { icon: LucideIcon; when: string; title: string; text: string }[] = [
  {
    icon: Activity,
    when: 'Through D−1',
    title: 'Forecast runs published',
    text: 'Elexon publishes a national wind forecast about eight times a day, each looking up to ~2.5 days ahead.',
  },
  {
    icon: Gavel,
    when: 'D−1, 09:20 / 09:50',
    title: 'Day-ahead gate closure',
    text: 'Bids for every half-hour of day D must be in. The latest run published before this is the one that counts.',
  },
  {
    icon: CalendarCheck,
    when: 'Day D',
    title: 'Delivery',
    text: 'Any wind shortfall against the forecast has to be bought back closer to real time, usually at a premium.',
  },
  {
    icon: Clock,
    when: 'After each half-hour',
    title: 'Outturn measured',
    text: 'Metered wind generation (FUELHH) arrives every 30 minutes and is compared with the forecast.',
  },
]

export function MethodologyView({ meta }: { meta: Meta }) {
  const c = meta.cleaning
  return (
    <>
      <PageHeader eyebrow="Methodology" title="How the numbers are produced">
        Every figure in this tool comes from two public Elexon datasets and a small set of explicit rules.
        This page documents them so the results can be checked and reproduced.
      </PageHeader>

      <div className={styles.stack}>
        <Card title="The decision this tool supports">
          <ol className={styles.steps}>
            {STEPS.map(({ icon: Icon, when, title, text }, i) => (
              <li key={title} className={styles.step}>
                <span className={styles.stepIcon} aria-hidden>
                  <Icon size={18} />
                </span>
                <span className={styles.stepWhen}>
                  {i + 1} · {when}
                </span>
                <strong className={styles.stepTitle}>{title}</strong>
                <span className={styles.stepText}>{text}</span>
              </li>
            ))}
          </ol>
        </Card>

        <div className={styles.grid}>
          <Card
            title="Data sources"
            subtitle={`Snapshot of ${formatDayCompact(meta.first_day)} – ${formatDayCompact(meta.last_day)} 2026, taken ${formatDateTime(meta.generated_at)}`}
          >
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Dataset</th>
                  <th scope="col">Content</th>
                  <th scope="col">Resolution</th>
                  <th scope="col" data-num>
                    Rows
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code>FUELHH</code>
                  </td>
                  <td>Actual generation, fuel type WIND</td>
                  <td>30 min</td>
                  <td data-num>{formatCount(meta.actual_rows)}</td>
                </tr>
                <tr>
                  <td>
                    <code>WINDFOR</code>
                  </td>
                  <td>Wind forecasts, {formatCount(meta.publish_runs)} runs</td>
                  <td>1 hour</td>
                  <td data-num>{formatCount(meta.forecast_rows)}</td>
                </tr>
              </tbody>
            </table>
            <p className={styles.note}>
              January is historical, so the cleaned data is stored with the app: results are reproducible and
              do not depend on Elexon being reachable. <code>python -m app.ingest</code> rebuilds it.
            </p>
          </Card>

          <Card title="Cleaning" subtitle="Every dropped row is counted, so nothing is removed silently">
            <dl className={styles.facts}>
              <div>
                <dt>Forecasts for hours already past</dt>
                <dd>{formatCount(c.forecast_dropped_negative_horizon)} dropped</dd>
                <p>
                  WINDFOR re-publishes recent hours after the fact. They are not forecasts, so they are
                  excluded.
                </p>
              </div>
              <div>
                <dt>Outside the delivery window</dt>
                <dd>{formatCount(c.forecast_dropped_outside_window)} dropped</dd>
                <p>Rows fetched as context but targeting hours before or after the study period.</p>
              </div>
              <div>
                <dt>Missing half-hours of actuals</dt>
                <dd>{formatCount(c.actual_missing_periods)}</dd>
              </div>
              <div>
                <dt>Hours without any forecast</dt>
                <dd>{formatCount(c.hours_without_forecast)}</dd>
              </div>
            </dl>
          </Card>

          <Card title="Choosing the forecast" subtitle="One rule, two cut-offs">
            <p className={styles.lead}>
              For every target hour <i>T</i>, use the{' '}
              <b>latest forecast run published at or before a cut-off</b>.
            </p>
            <div className={styles.modes}>
              <div>
                <h3>At gate closure</h3>
                <code className={styles.formula}>cut-off = gate closure on D−1</code>
                <p>
                  What the trader actually had. EPEX closes at{' '}
                  {formatClock(meta.gate_closures.EPEX ?? '09:20')} and N2EX at{' '}
                  {formatClock(meta.gate_closures.N2EX ?? '09:50')} (UK time) on the day before delivery. The
                  default is the earlier one.
                </p>
              </div>
              <div>
                <h3>Fixed look-ahead</h3>
                <code className={styles.formula}>cut-off = T − H hours</code>
                <p>
                  How accuracy decays with lead time, from 0 to 48 h. Forecasts reach up to{' '}
                  {formatHours(c.max_forecast_horizon_h)} ahead.
                </p>
              </div>
            </div>
            <p className={styles.note}>
              Forecasts are hourly and actuals half-hourly, so each forecast is compared with the actual for
              the half-hour starting at the same time.
            </p>
          </Card>

          <Card title="Metrics" subtitle="Error = actual − forecast. Negative means less wind than forecast.">
            <dl className={styles.metrics}>
              <dt>MAE</dt>
              <dd>Mean absolute error: the typical size of a miss, in MW.</dd>
              <dt>RMSE</dt>
              <dd>Root mean squared error; weights large misses more heavily.</dd>
              <dt>Bias</dt>
              <dd>Mean error. A persistent negative bias means the forecast systematically runs high.</dd>
              <dt>nMAE</dt>
              <dd>
                Total absolute error ÷ total actual output. Used instead of MAPE, which breaks near zero
                output.
              </dd>
              <dt>P10 / P90</dt>
              <dd>Percentiles of the error; 80% of hours fall between them.</dd>
              <dt>Cover</dt>
              <dd>
                Minus the P10 error: extra supply that would have covered the shortfall in 9 of 10 hours.
              </dd>
            </dl>
          </Card>
        </div>

        <Card title="Findings and caveats">
          <ul className={styles.caveats}>
            <li>
              <b>Systematic over-forecast.</b> The forecast exceeds outturn even for hours only minutes ahead,
              which points to a structural gap rather than weather error. A likely cause is wind curtailed by
              the system operator (turned down for grid constraints), which metered outturn reflects and an
              unconstrained forecast does not. This is a hypothesis to confirm with the client.
            </li>
            <li>
              <b>The error band is in-sample.</b> It uses errors from the same period it is drawn on. In
              production it would be fitted on a trailing window.
            </li>
            <li>
              <b>National level only.</b> Regional and embedded (distribution-connected) wind are outside the
              scope of these datasets.
            </li>
            <li>
              <b>Times.</b> All data is stored in UTC and shown in UK local time. Delivery days and gate
              closures follow the UK clock, including the clock-change days.
            </li>
          </ul>
        </Card>

        <Card title="Under the hood">
          <div className={styles.arch}>
            <div className={styles.archBox}>
              <strong>Elexon BMRS</strong>
              <span>FUELHH · WINDFOR stream API</span>
            </div>
            <span className={styles.archArrow} aria-hidden>
              →
            </span>
            <div className={styles.archBox}>
              <strong>Ingestion (Python)</strong>
              <span>chunked fetch, retries, cleaning, CSV snapshot</span>
            </div>
            <span className={styles.archArrow} aria-hidden>
              →
            </span>
            <div className={styles.archBox}>
              <strong>FastAPI + pandas</strong>
              <span>forecast selection, metrics, typed JSON API</span>
            </div>
            <span className={styles.archArrow} aria-hidden>
              →
            </span>
            <div className={styles.archBox}>
              <strong>React + TypeScript</strong>
              <span>Recharts, TanStack Query, shareable URL state</span>
            </div>
          </div>
          <p className={styles.links}>
            <a href="/api/docs" target="_blank" rel="noreferrer">
              Interactive API docs
            </a>
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              Source code
            </a>
            <a href="https://bmrs.elexon.co.uk/api-documentation" target="_blank" rel="noreferrer">
              Elexon API documentation
            </a>
          </p>
        </Card>
      </div>
    </>
  )
}
