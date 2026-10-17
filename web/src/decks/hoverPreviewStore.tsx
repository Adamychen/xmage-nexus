import { useSyncExternalStore } from 'react'
import DeckHoverPreview, { type HoverPreview } from './DeckHoverPreview'

export interface HoverPreviewStore {
  get(): HoverPreview | null
  set(next: HoverPreview | null): void
  subscribe(listener: () => void): () => void
}

export function createHoverPreviewStore(): HoverPreviewStore {
  let current: HoverPreview | null = null
  const listeners = new Set<() => void>()
  return {
    get: () => current,
    set(next) {
      if (next === current) return
      current = next
      listeners.forEach((listener) => listener())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}

export function HoverPreviewLayer({ store, hidden }: { store: HoverPreviewStore; hidden: boolean }) {
  const preview = useSyncExternalStore(store.subscribe, store.get)
  return !hidden && preview ? <DeckHoverPreview preview={preview} /> : null
}
