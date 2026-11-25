import { useLayoutEffect, useRef } from 'react'
import { fxMotionAllowed } from './fx'

const DURATION_MS = 260
const STAGGER_MS = 30
const MIN_MOVE_PX = 2
const MAX_MOVE_PX = 900
const EASING = 'cubic-bezier(0.16, 1, 0.3, 1)'

interface Spot {
  x: number
  y: number
  tapped: string
}

/**
 * FX-16: the slide offset a card is carrying right now, as computed style reports it, so a position
 * can be read as the one the layout gave it rather than wherever an animation has it at this instant.
 * Covers the `translate` property this FLIP animates and the one the Arena combat lunges set in CSS.
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

/** FX-16: the centre the layout gave a card, with any slide it is carrying taken back out. */
export function settledCentre(rect: { left: number; top: number; width: number; height: number }, translate: string): { x: number; y: number } {
  const offset = translateOffset(translate)
  return { x: rect.left + rect.width / 2 - offset.x, y: rect.top + rect.height / 2 - offset.y }
}

/**
 * FLIP for permanents that change tapped state: a tap regroups piles (a tapped
 * land leaves the untapped pile for the tapped one), and React remounts the
 * card in its new place. The centre of a card does not move when it rotates, so
 * comparing centres between commits finds the cards that really changed place;
 * each one then slides in from where it was. The slide uses the independent
 * `translate` property so it composes with the tap rotation in `transform`.
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
      // FX-16: read the place the layout gave the card, not where a slide still in the air has it;
      // otherwise the next commit animates from a point the card never really occupied.
      const centre = settledCentre(r, getComputedStyle(node).translate)
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
    let order = 0
    for (const { node, dx, dy, tapChanged } of moves) {
      if (typeof node.animate !== 'function') return
      node.animate(
        [{ translate: `${dx}px ${dy}px` }, { translate: '0px 0px' }],
        { duration: DURATION_MS, delay: tapChanged ? order++ * STAGGER_MS : 0, easing: EASING, fill: 'backwards' },
      )
    }
  })
}
