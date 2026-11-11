import { useEffect, useRef } from 'react'
import { anyLayerOpen } from '../ui/useEscape'

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || typeof el.closest !== 'function') return false
  return el.isContentEditable || el.closest('input, textarea, select, [contenteditable]') !== null
}

/**
 * Escape backs out of an in-board prompt (targeting or mana bar) that the server lets the player
 * cancel (PRM-13). The bars are not dialog layers, so the key is left to any open layer, to text
 * fields and to every other handler: the cancel runs only once the event finished dispatching
 * without anyone else claiming it.
 */
export function usePromptCancelKey(onCancel: (() => void) | null): void {
  const latest = useRef(onCancel)
  useEffect(() => {
    latest.current = onCancel
  })
  const enabled = onCancel !== null
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.repeat || e.defaultPrevented) return
      if (anyLayerOpen() || isTyping(e.target)) return
      setTimeout(() => {
        if (!e.defaultPrevented) latest.current?.()
      }, 0)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}
