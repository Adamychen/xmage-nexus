import { useSyncExternalStore } from 'react'

export const DECK_PHONE_QUERY = '(max-width: 699px)'

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined
  const mq = window.matchMedia(DECK_PHONE_QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

function snapshot(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(DECK_PHONE_QUERY).matches
}

export function useDeckPhoneLayout(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false)
}
