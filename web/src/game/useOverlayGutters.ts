import { useLayoutEffect, type RefObject } from 'react'

const ZONE = '.arena-board > .zone-bottom'
const LEFT_OVERLAYS = ['.arena-board > .zone-bottom .pz-bottom-row', '[data-testid="combat-ledger"]', '[data-testid="log-ticker"]']
const RIGHT_OVERLAYS = ['[data-testid="game-dock"]']
const CAPPED_OVERLAYS = ['[data-testid="combat-ledger"]', '[data-testid="log-ticker"]']
const DIVIDER = '.arena-board > .board-shell-divider'
const COMMANDER = '.pz-commander'
const COMMAND_ITEMS = '.command-zone > *'
const GAP = 16
const COMMAND_ZONE_CHROME = 16
const COMMAND_ITEM_GAP = 6
const MIN_COMMANDER_W = 56

function overlapsVertically(a: DOMRect, b: DOMRect): boolean {
  return a.top < b.bottom && a.bottom > b.top
}

/** Docks the own command zone in the left column, right above the highest of the overlays
 *  stacked there (last actions, combat ledger, portrait), so it follows them as they grow or
 *  collapse. Its cards take the whole room left between the divider and that overlay, as wide
 *  as the column allows; when not even a small card fits, the zone stays in the creatures row. */
function dockCommander(wrap: HTMLElement, zone: HTMLElement, zoneRect: DOMRect, zoom: number) {
  const dock = zone.querySelector<HTMLElement>(COMMANDER)
  if (!dock) return
  let anchorTop = Infinity
  let colLeft = Infinity
  let colRight = -Infinity
  for (const sel of LEFT_OVERLAYS) {
    const el = wrap.querySelector<HTMLElement>(sel)
    if (!el) continue
    const r = el.getBoundingClientRect()
    if (r.width === 0) continue
    anchorTop = Math.min(anchorTop, r.top)
    colLeft = Math.min(colLeft, r.left)
    colRight = Math.max(colRight, r.right)
  }
  const divider = wrap.querySelector<HTMLElement>(DIVIDER)
  const ceiling = Math.max(zoneRect.top, divider ? divider.getBoundingClientRect().bottom : -Infinity)
  const items = Math.max(1, dock.querySelectorAll(COMMAND_ITEMS).length)
  const baseW = parseFloat(zone.style.getPropertyValue('--card-w')) || 116
  const ratio = parseFloat(getComputedStyle(dock).getPropertyValue('--card-h-ratio')) || 1.4
  const colW = (colRight - colLeft) / zoom
  const colH = (anchorTop - ceiling) / zoom - GAP
  const cardW = Math.floor(Math.min(
    (colW - COMMAND_ZONE_CHROME - COMMAND_ITEM_GAP * (items - 1)) / items,
    (colH - COMMAND_ZONE_CHROME) / ratio,
  ))
  if (!Number.isFinite(cardW) || cardW < Math.min(baseW, MIN_COMMANDER_W)) {
    delete zone.dataset.commanderDock
    return
  }
  zone.dataset.commanderDock = 'column'
  zone.style.setProperty('--cmd-left', `${Math.round((colLeft - zoneRect.left) / zoom)}px`)
  zone.style.setProperty('--cmd-bottom', `${Math.round((zoneRect.bottom - anchorTop) / zoom + GAP / 2)}px`)
  zone.style.setProperty('--cmd-card-w', `${cardW}px`)
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
      dockCommander(wrap, zone, zoneRect, zoom)
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
