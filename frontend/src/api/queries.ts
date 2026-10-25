/**
 * React Query hooks. The snapshot never changes while the app is open, so results
 * are cached for the session; placeholderData keeps the previous chart on screen
 * (dimmed) while a new selection loads, instead of flashing a skeleton.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { api, type Selection } from './client'

const forever = { staleTime: Infinity, gcTime: Infinity } as const

export const useMeta = () => useQuery({ queryKey: ['meta'], queryFn: api.meta, ...forever })

export const useSeries = (s: Selection | null) =>
  useQuery({
    queryKey: ['series', s],
    queryFn: () => api.series(s!),
    enabled: s !== null,
    placeholderData: keepPreviousData,
    ...forever,
  })

export const useMetrics = (s: Selection | null) =>
  useQuery({
    queryKey: ['metrics', s],
    queryFn: () => api.metrics(s!),
    enabled: s !== null,
    placeholderData: keepPreviousData,
    ...forever,
  })

export const useHorizonProfile = (start: string | null, end: string | null) =>
  useQuery({
    queryKey: ['horizon', start, end],
    queryFn: () => api.horizonProfile(start!, end!),
    enabled: start !== null && end !== null,
    placeholderData: keepPreviousData,
    ...forever,
  })
