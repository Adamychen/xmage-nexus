import { useLayoutEffect, useRef } from 'react'
import { fxMotionAllowed } from './fx'
import { ARENA_EASE, fxRun, gsap } from '../fx/fxEngine'

const DURATION_S = 0.24
const STAGGER_S = 0.024
const MIN_MOVE_PX = 2
const MAX_MOVE_PX = 900

interface Spot {
  x: number
  y: number
  tapped: string
}

/**
 * Reads a CSS `translate` offset so a card's position is measured where layout
 * placed it, not where an active slide or combat lunge has it right now.
 */
export function translateOffset(value: string): { x: number; y: number } {
  if (!value || value === 'none') return { x: 0, y: 0 }
  const parts = value.trim().split(/\s+/)
  const num = (part: string | undefined) => {
    const n = parseFloat(part ?? '')
    return Number.isFinite(n) ? n : 0
  }
  return { x: num(parts[0]), y: num(parts[1]) }
}

/** Layout centre of a card, with any active CSS or GSAP slide offset taken back out. */
export function settledCentre(
  rect: { left: number; top: number; width: number; height: number },
  translate: string,
  gsapX = 0,
  gsapY = 0,
): { x: number; y: number } {
  const offset = translateOffset(translate)
  return {
    x: rect.left + rect.width / 2 - offset.x - gsapX,
    y: rect.top + rect.height / 2 - offset.y - gsapY,
  }
}

/**
 * GSAP-driven FLIP for permanents that regroup when tapped/untapped.
 * Interruptible across rapid consecutive taps and automatically scaled by the
 * global GSAP clock (`fxEngine`).
 */
export function useTapFlip(el: HTMLElement | null): void {
  const previous = useRef<Map<string, Spot>>(new Map())

  useLayoutEffect(() => {
    if (!el) return
    const next = new Map<string, Spot>()
    const moves: { node: HTMLElement; dx: number; dy: number; tapChanged: boolean }[] = []
    let anyTapChanged = false

    el.querySelectorAll<HTMLElement>('[data-card-id][data-tapped]').forEach((node) => {
      const id = node.dataset.cardId as string
      const r = node.getBoundingClientRect()
      const tweening = gsap.isTweening(node)
      const gx = tweening ? Number(gsap.getProperty(node, 'x')) || 0 : 0
      const gy = tweening ? Number(gsap.getProperty(node, 'y')) || 0 : 0
      const centre = settledCentre(r, getComputedStyle(node).translate, gx, gy)
      const spot: Spot = { x: centre.x, y: centre.y, tapped: node.dataset.tapped ?? '' }
      next.set(id, spot)
      const before = previous.current.get(id)
      if (!before) return
      const tapChanged = before.tapped !== spot.tapped
      anyTapChanged ||= tapChanged
      const dx = before.x - spot.x
      const dy = before.y - spot.y
      const dist = Math.hypot(dx, dy)
      if (dist >= MIN_MOVE_PX && dist <= MAX_MOVE_PX) moves.push({ node, dx, dy, tapChanged })
    })

    previous.current = next
    if (!anyTapChanged || moves.length === 0 || !fxMotionAllowed()) return

    fxRun(() => {
      let order = 0
      for (const { node, dx, dy, tapChanged } of moves) {
        gsap.fromTo(
          node,
          { x: dx, y: dy },
          {
            x: 0,
            y: 0,
            duration: DURATION_S,
            delay: tapChanged ? order++ * STAGGER_S : 0,
            ease: ARENA_EASE.snapOut,
            overwrite: 'auto',
            clearProps: 'x,y',
          },
        )
      }
    })
  })
}
