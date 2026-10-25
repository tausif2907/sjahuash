/**
 * App state lives in the query string, so every view is a shareable link and the
 * browser's back button works. Values equal to their default are left out of the URL.
 */
import { useCallback, useMemo, useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('popstate', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('popstate', listener)
  }
}

const getSearch = () => window.location.search

export function useUrlState<K extends string>(
  defaults: Readonly<Record<K, string>>,
): [Record<K, string>, (patch: Partial<Record<K, string>>, opts?: { push?: boolean }) => void] {
  const search = useSyncExternalStore(subscribe, getSearch, () => '')

  const state = useMemo(() => {
    const params = new URLSearchParams(search)
    const keys = Object.keys(defaults) as K[]
    return Object.fromEntries(keys.map((k) => [k, params.get(k) ?? defaults[k]])) as Record<K, string>
  }, [search, defaults])

  const setState = useCallback(
    (patch: Partial<Record<K, string>>, { push = false } = {}) => {
      const params = new URLSearchParams(window.location.search)
      for (const [key, value] of Object.entries(patch) as [K, string | undefined][]) {
        if (value === undefined || value === defaults[key]) params.delete(key)
        else params.set(key, value)
      }
      const query = params.toString()
      const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
      window.history[push ? 'pushState' : 'replaceState'](null, '', url)
      listeners.forEach((l) => l())
    },
    [defaults],
  )

  return [state, setState]
}
