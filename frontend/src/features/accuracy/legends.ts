import { C } from '../../components/charts/chartTheme'
import type { LegendItem } from '../../components/charts/Legend'

export const profileLegend: LegendItem[] = [
  { label: 'Mean absolute error', color: C.actual, kind: 'line' },
  { label: 'Bias (mean error)', color: C.forecast, kind: 'line' },
  { label: 'P10–P90 error range', color: C.band, kind: 'band' },
]

export const dailyLegend: LegendItem[] = [
  { label: 'Bias: less wind than forecast', color: C.shortfall, kind: 'rect' },
  { label: 'Bias: more wind than forecast', color: C.surplus, kind: 'rect' },
  { label: 'Mean absolute error', color: C.neutral, kind: 'line' },
]

export const signLegend: LegendItem[] = [
  { label: 'Less wind than forecast', color: C.shortfall, kind: 'rect' },
  { label: 'More wind than forecast', color: C.surplus, kind: 'rect' },
]
