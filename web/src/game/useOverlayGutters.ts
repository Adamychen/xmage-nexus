import { useLayoutEffect, type RefObject } from 'react'

const ZONE = '.arena-board > .zone-bottom'
const LEFT_OVERLAYS = ['.arena-board > .zone-bottom .pz-bottom-row', '[data-testid="combat-ledger"]', '[data-testid="log-ticker"]']
const RIGHT_OVERLAYS = ['[data-testid="game-dock"]']
const CAPPED_OVERLAYS = ['[data-testid="combat-ledger"]', '[data-testid="log-ticker"]']
const DIVIDER = '.arena-board > .board-shell-divider'
const GAP = 16

function overlapsVertically(a: DOMRect, b: DOMRect): boolean {
  return a.top < b.bottom && a.bottom > b.top
}

/** Keeps the own battlefield between the overlays the v2 chrome floats over the board: the
 *  own portrait, the last-actions box and the combat ledger on the left, the phase dial and
 *  its action button on the right. The gutters are measured, not budgeted: the overlays
 *  change size with their content, the window and the side panel. */
export function useOverlayGutters(wrapRef: RefObject<HTMLElement | null>, enabled: boolean, remeasureKey: string) {
  useLayoutEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || !enabled) return
    const measure = () => {
      const zone = wrap.querySelector<HTMLElement>(ZONE)
      if (!zone) return
      const zoneRect = zone.getBoundingClientRect()
      const zoom = zone.offsetWidth > 0 ? zoneRect.width / zone.offsetWidth : 1
      if (!(zoom > 0)) return
      let left = 0
      let right = 0
      for (const sel of LEFT_OVERLAYS) {
        const el = wrap.querySelector<HTMLElement>(sel)
        if (!el) continue
        const r = el.getBoundingClientRect()
        if (r.width === 0 || !overlapsVertically(r, zoneRect)) continue
        left = Math.max(left, (r.right - zoneRect.left) / zoom + GAP)
      }
      for (const sel of RIGHT_OVERLAYS) {
        const el = wrap.querySelector<HTMLElement>(sel)
        if (!el) continue
        const r = el.getBoundingClientRect()
        if (r.width === 0 || !overlapsVertically(r, zoneRect)) continue
        right = Math.max(right, (zoneRect.right - r.left) / zoom + GAP)
      }
      const portrait = wrap.querySelector<HTMLElement>(LEFT_OVERLAYS[0])
      if (portrait) {
        const wrapRect = wrap.getBoundingClientRect()
        const fromBottom = (wrapRect.bottom - portrait.getBoundingClientRect().top) / zoom + GAP
        wrap.style.setProperty('--overlay-bottom', `${Math.round(Math.max(0, fromBottom))}px`)
      }
      const divider = wrap.querySelector<HTMLElement>(DIVIDER)
      if (divider) {
        const floor = divider.getBoundingClientRect().bottom
        for (const sel of CAPPED_OVERLAYS) {
          const el = wrap.querySelector<HTMLElement>(sel)
          if (!el) continue
          const r = el.getBoundingClientRect()
          if (r.width === 0) continue
          el.style.maxHeight = `${Math.max(0, Math.floor((r.bottom - floor - GAP / 2) / zoom))}px`
          el.style.overflowY = 'auto'
        }
      }
      wrap.style.setProperty('--me-gutter-l', `${Math.round(Math.max(0, left))}px`)
      wrap.style.setProperty('--me-gutter-r', `${Math.round(Math.max(0, right))}px`)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const resize = new ResizeObserver(measure)
    const watch = () => {
      resize.disconnect()
      resize.observe(wrap)
      for (const sel of [ZONE, ...LEFT_OVERLAYS, ...RIGHT_OVERLAYS]) {
        const el = wrap.querySelector(sel)
        if (el) resize.observe(el)
      }
      measure()
    }
    watch()
    const mutations = new MutationObserver(watch)
    mutations.observe(wrap, { childList: true, subtree: true })
    const onTransition = () => measure()
    wrap.addEventListener('transitionend', onTransition)
    wrap.addEventListener('animationend', onTransition)
    return () => {
      resize.disconnect()
      mutations.disconnect()
      wrap.removeEventListener('transitionend', onTransition)
      wrap.removeEventListener('animationend', onTransition)
    }
  }, [wrapRef, enabled, remeasureKey])
}
