import { useCallback, useEffect, useRef, useState } from "react"

// Module-level caches so lookups are fetched at most once per session and are
// shared across form mounts (Create -> Save -> New stays cheap).
const cache = new Map<string, unknown>()
const inflight = new Map<string, Promise<unknown>>()

export interface LazyOptionsState<T> {
  value: T
  loading: boolean
  ensure: () => void
}

export function getCachedLookup<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined
}

/**
 * Lazily loads dropdown options on first focus/interaction.
 *
 * - The fetcher runs at most once per session for a given key; concurrent
 *   consumers share the in-flight promise.
 * - `empty` is the initial value (usually [] for option lists).
 */
export function useLazyOptions<T>(key: string, fetcher: () => Promise<T>, empty: T): LazyOptionsState<T> {
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const [state, setState] = useState<T>(() => (cache.has(key) ? (cache.get(key) as T) : empty))
  const [loading, setLoading] = useState(false)

  // Reflect a value another hook instance cached while this one was idle
  // (e.g. after navigating back to a form that uses the same lookup).
  useEffect(() => {
    if (cache.has(key)) setState(cache.get(key) as T)
  }, [key])

  const ensure = useCallback(() => {
    if (cache.has(key)) return
    if (inflight.has(key)) return
    setLoading(true)
    const promise = fetcherRef.current()
    inflight.set(key, promise)
    promise
      .then((result) => {
        cache.set(key, result)
        setState(result)
      })
      .catch(() => {
        // Leave empty; next focus retries.
      })
      .finally(() => {
        inflight.delete(key)
        setLoading(false)
      })
  }, [key])

  return { value: state, loading, ensure }
}
