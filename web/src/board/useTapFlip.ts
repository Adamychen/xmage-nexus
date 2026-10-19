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
      const spot: Spot = { x: r.left + r.width / 2, y: r.top + r.height / 2, tapped: node.dataset.tapped ?? '' }
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
