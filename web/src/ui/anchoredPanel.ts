import { useEffect, useLayoutEffect, type KeyboardEvent, type RefObject } from 'react'

const PANEL_GAP = 6
const VIEWPORT_MARGIN = 8
const MIN_PANEL_HEIGHT = 120

export interface AnchorOptions {
  prefer?: 'down' | 'up'
  align?: 'start' | 'end'
  boundary?: string
  matchWidth?: boolean
}

export function surfaceClassOf(el: Element | null): string {
  const surface = el?.closest('.chrome-surface, .board-surface')
  if (!surface) return ''
  return surface.classList.contains('chrome-surface') ? 'chrome-surface' : 'board-surface'
}

export function placePanel(trigger: HTMLElement, panel: HTMLElement, { prefer = 'down', align = 'start', boundary, matchWidth = true }: AnchorOptions = {}) {
  const rect = trigger.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  if (matchWidth) panel.style.minWidth = `${rect.width}px`
  const below = vh - rect.bottom - PANEL_GAP - VIEWPORT_MARGIN
  const above = rect.top - PANEL_GAP - VIEWPORT_MARGIN
  const needed = panel.scrollHeight
  const up = prefer === 'up' ? needed <= above || above > below : needed > below && above > below
  panel.style.maxHeight = `${Math.max(MIN_PANEL_HEIGHT, up ? above : below)}px`
  panel.style.top = up ? '' : `${rect.bottom + PANEL_GAP}px`
  panel.style.bottom = up ? `${vh - rect.top + PANEL_GAP}px` : ''
  const width = panel.getBoundingClientRect().width || panel.offsetWidth
  const limit = boundary ? trigger.closest(boundary)?.getBoundingClientRect().right : undefined
  const right = Math.min(vw - VIEWPORT_MARGIN, limit ?? Number.POSITIVE_INFINITY)
  const toEnd = align === 'end' || rect.left + width > right
  const left = toEnd ? rect.right - width : rect.left
  panel.style.left = `${Math.max(VIEWPORT_MARGIN, Math.min(left, vw - VIEWPORT_MARGIN - width))}px`
  panel.dataset.side = up ? 'top' : 'bottom'
  panel.dataset.align = toEnd ? 'end' : 'start'
}

export function useAnchoredPanel(
  open: boolean,
  triggerRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
  options: AnchorOptions,
  revision: unknown = 0,
) {
  const { prefer, align, boundary, matchWidth } = options
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const trigger = triggerRef.current
      const panel = panelRef.current
      if (trigger && panel) placePanel(trigger, panel, { prefer, align, boundary, matchWidth })
    }
    place()
    const onScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return
      place()
    }
    window.addEventListener('resize', place)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, triggerRef, panelRef, prefer, align, boundary, matchWidth, revision])
}

const MENU_ITEMS = '[role^="menuitem"]:not(:disabled):not([aria-disabled="true"]), button:not(:disabled), input:not(:disabled), [href]'

function menuItems(panel: HTMLElement | null): HTMLElement[] {
  if (!panel) return []
  return [...panel.querySelectorAll<HTMLElement>(MENU_ITEMS)].filter((el) => el.getAttribute('aria-hidden') !== 'true')
}

export function useMenuFocus(open: boolean, panelRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return
    const first = panelRef.current?.querySelector<HTMLElement>('[role^="menuitem"]:not(:disabled)') ?? menuItems(panelRef.current)[0]
    first?.focus()
  }, [open, panelRef])
}

export function menuKeyDown(e: KeyboardEvent<HTMLElement>, panel: HTMLElement | null, onClose?: () => void) {
  const items = menuItems(panel)
  if (items.length === 0) return
  const index = items.indexOf(document.activeElement as HTMLElement)
  let next = -1
  if (e.key === 'ArrowDown') next = index < 0 ? 0 : (index + 1) % items.length
  else if (e.key === 'ArrowUp') next = index < 0 ? items.length - 1 : (index - 1 + items.length) % items.length
  else if (e.key === 'Home') next = 0
  else if (e.key === 'End') next = items.length - 1
  else if (e.key === 'Tab') {
    onClose?.()
    return
  }
  if (next < 0) return
  e.preventDefault()
  items[next].focus()
}
