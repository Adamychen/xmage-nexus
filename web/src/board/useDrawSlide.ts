import { useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { fxMotionAllowed, fxOpacityAllowed } from './fx'
import { drawnCardIds, drawOffset, handReturnPile, pileAnchor } from './drawSlide'
import { ARENA_EASE, fxTimeline } from '../fx/fxEngine'

export type DrawMode = 'slide' | 'fade'

export interface DrawAnchor {
  scope: string
  select: string
}

const DRAW_SLIDE_S = 0.34
const DRAW_FADE_S = 0.15
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

/**
 * Arena-style card draw: newly drawn cards whip from the library (or return pile)
 * into their hand slot with a crisp scale & tilt settle via GSAP.
 */
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
      const libraryRect = anchorElement(scope, { scope: anchorScope, select: anchorSelect })?.getBoundingClientRect()
      let staggerIndex = 0
      for (const slot of Array.from(scope.querySelectorAll<HTMLElement>('[data-hand-id]'))) {
        const id = slot.dataset.handId ?? ''
        if (!fresh.includes(id)) continue
        const pile = handReturnPile(id)
        const anchorRect = (pile ? anchorElement(scope, { scope: anchorScope, select: pileAnchor(anchorSelect, pile) })?.getBoundingClientRect() : null) ?? libraryRect
        const offset = anchorRect ? drawOffset(anchorRect, slot.getBoundingClientRect()) : { dx: 0, dy: 0 }

        if (mode === 'fade') {
          const tl = fxTimeline(undefined, { allowReducedMotion: true })
          tl?.fromTo(
            slot,
            { opacity: 0 },
            { opacity: 1, duration: DRAW_FADE_S, ease: 'power2.out', clearProps: 'opacity' },
          )
        } else {
          const tl = fxTimeline()
          tl?.fromTo(
            slot,
            { x: offset.dx, y: offset.dy, scale: 0.62, rotation: -8, opacity: 0.35 },
            {
              x: 0,
              y: 0,
              scale: 1,
              rotation: 0,
              opacity: 1,
              duration: DRAW_SLIDE_S,
              delay: staggerIndex++ * 0.045,
              ease: ARENA_EASE.snapOut,
              clearProps: 'x,y,scale,rotation,opacity',
            },
          )
        }
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
