import { useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { fxMotionAllowed, fxMotionDuration, fxOpacityAllowed, fxOpacityDuration } from './fx'
import { drawnCardIds, drawOffset } from './drawSlide'

export type DrawMode = 'slide' | 'fade'

export interface DrawAnchor {
  scope: string
  select: string
}

const DRAW_SLIDE_MS = 550
const DRAW_FADE_MS = 150
const NO_DRAWS: ReadonlyMap<string, DrawMode> = new Map()

function drawMode(): DrawMode | null {
  if (fxMotionAllowed()) return 'slide'
  return fxOpacityAllowed() ? 'fade' : null
}

function anchorElement(scope: HTMLElement, anchor: DrawAnchor): Element | null {
  const root = scope.closest(anchor.scope)
  if (!root) return null
  return Array.from(root.querySelectorAll(anchor.select)).find((el) => el.getBoundingClientRect().width > 0) ?? null
}

function sameDraws(a: ReadonlyMap<string, DrawMode>, b: ReadonlyMap<string, DrawMode>): boolean {
  if (a.size !== b.size) return false
  for (const [id, mode] of a) if (b.get(id) !== mode) return false
  return true
}

export function useDrawSlide(
  scopeRef: RefObject<HTMLElement | null>,
  ids: readonly string[],
  enabled: boolean,
  anchor: DrawAnchor,
): ReadonlyMap<string, DrawMode> {
  const key = ids.join('\n')
  const prevRef = useRef<readonly string[]>([])
  const [draws, setDraws] = useState<ReadonlyMap<string, DrawMode>>(NO_DRAWS)
  const anchorScope = anchor.scope
  const anchorSelect = anchor.select

  useLayoutEffect(() => {
    const next = key === '' ? [] : key.split('\n')
    const prev = prevRef.current
    prevRef.current = next
    const scope = scopeRef.current
    const mode = drawMode()
    const fresh = enabled && mode && scope ? drawnCardIds(prev, next) : []

    if (scope && mode && fresh.length > 0) {
      const anchorEl = anchorElement(scope, { scope: anchorScope, select: anchorSelect })
      const anchorRect = anchorEl?.getBoundingClientRect()
      const ms = mode === 'slide' ? fxMotionDuration(DRAW_SLIDE_MS) : fxOpacityDuration(DRAW_FADE_MS)
      for (const slot of Array.from(scope.querySelectorAll<HTMLElement>('[data-hand-id]'))) {
        if (!fresh.includes(slot.dataset.handId ?? '')) continue
        const offset = anchorRect ? drawOffset(anchorRect, slot.getBoundingClientRect()) : { dx: 0, dy: 0 }
        slot.style.setProperty('--draw-dx', `${offset.dx}px`)
        slot.style.setProperty('--draw-dy', `${offset.dy}px`)
        slot.style.setProperty('--draw-ms', `${ms}ms`)
      }
    }

    setDraws((cur) => {
      const kept = new Map<string, DrawMode>()
      for (const [id, m] of cur) if (next.includes(id)) kept.set(id, m)
      if (mode) for (const id of fresh) kept.set(id, mode)
      return sameDraws(cur, kept) ? cur : kept
    })
  }, [key, enabled, scopeRef, anchorScope, anchorSelect])

  return draws
}
