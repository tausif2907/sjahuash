import { lazy, Suspense, useEffect } from 'react'

import { useMeta } from './api/queries'
import { asView, useAppState, type View } from './appState'
import styles from './App.module.css'
import { Footer } from './components/layout/Footer'
import { Header } from './components/layout/Header'
import { ErrorState, Skeleton } from './components/ui/States'
import { useTheme } from './lib/theme'

// Each view is its own chunk; the shell renders before any chart code has loaded.
const DayAheadView = lazy(() =>
  import('./features/day-ahead/DayAheadView').then((m) => ({ default: m.DayAheadView })),
)
const AccuracyView = lazy(() =>
  import('./features/accuracy/AccuracyView').then((m) => ({ default: m.AccuracyView })),
)
const MethodologyView = lazy(() =>
  import('./features/methodology/MethodologyView').then((m) => ({ default: m.MethodologyView })),
)

const TITLES: Record<View, string> = {
  day: 'Day-ahead view',
  accuracy: 'Forecast accuracy',
  method: 'Methodology',
}

export default function App() {
  const [theme, toggleTheme] = useTheme()
  const [state, setState] = useAppState()
  const view = asView(state.view)
  const meta = useMeta()

  useEffect(() => {
    document.title = `${TITLES[view]} · Wind Forecast Monitor`
  }, [view])

  const navigate = (next: View) => {
    setState({ view: next }, { push: true })
    window.scrollTo({ top: 0 })
  }

  return (
    <div className={styles.app}>
      <a href="#main" className={styles.skip}>
        Skip to content
      </a>
      <Header view={view} onNavigate={navigate} meta={meta.data} theme={theme} onToggleTheme={toggleTheme} />
      <main id="main" className={styles.main}>
        {meta.isError ? (
          <ErrorState message={meta.error.message} onRetry={() => meta.refetch()} />
        ) : !meta.data ? (
          <Skeleton height={520} />
        ) : (
          <Suspense fallback={<Skeleton height={520} />}>
            {view === 'day' ? (
              <DayAheadView meta={meta.data} />
            ) : view === 'accuracy' ? (
              <AccuracyView meta={meta.data} />
            ) : (
              <MethodologyView meta={meta.data} />
            )}
          </Suspense>
        )}
      </main>
      <Footer />
    </div>
  )
}
