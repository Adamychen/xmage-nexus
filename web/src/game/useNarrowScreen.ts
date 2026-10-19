import { useSyncExternalStore } from 'react'

export const NARROW_QUERY = '(max-width: 600px)'

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined
  const mq = window.matchMedia(NARROW_QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

function snapshot(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(NARROW_QUERY).matches
}

export function useNarrowScreen(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false)
}
