import { useLayoutEffect, type RefObject } from 'react'
import { resolveBadgeLayout, type BadgeBox } from './badgeLayout'

function zoneRect(el: HTMLElement): DOMRect {
  const kids = [...el.children].filter((c) => c instanceof HTMLElement) as HTMLElement[]
  if (el.dataset.badgeZone !== 'keyword' || kids.length === 0) return el.getBoundingClientRect()
  const rects = kids.map((k) => k.getBoundingClientRect())
  const left = Math.min(...rects.map((r) => r.left))
  const right = Math.max(...rects.map((r) => r.right))
  const top = Math.min(...rects.map((r) => r.top))
  const bottom = Math.max(...rects.map((r) => r.bottom))
  return new DOMRect(left, top, right - left, bottom - top)
}

export function useBadgeLayout(slotRef: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const slot = slotRef.current
    if (!slot) return
    let last = ''
    const run = (force: boolean) => {
      const zones = [...slot.querySelectorAll<HTMLElement>('[data-badge-zone]')]
      const signature = zones.map((z) => `${z.dataset.badgeZone}:${z.childElementCount}:${z.textContent?.length ?? 0}:${z.className}`).join('|')
      if (!force && signature === last) return
      last = signature
      for (const z of zones) {
        z.style.translate = ''
        z.removeAttribute('data-badge-hidden')
      }
      if (zones.length < 2) return
      const slotRect = slot.getBoundingClientRect()
      const mid = slotRect.top + slotRect.height / 2
      const boxes: BadgeBox[] = zones.map((z, i) => {
        const r = zoneRect(z)
        return {
          id: String(i),
          zone: z.dataset.badgeZone ?? '',
          edge: (r.top + r.bottom) / 2 < mid ? 'top' : 'bottom',
          top: r.top,
          bottom: r.bottom,
          left: r.left,
          right: r.right,
        }
      })
      const { shifts, hidden } = resolveBadgeLayout(boxes, { top: slotRect.top, bottom: slotRect.bottom })
      zones.forEach((z, i) => {
        const dy = shifts.get(String(i)) ?? 0
        if (dy) z.style.translate = `0 ${dy}px`
        if (hidden.has(String(i))) z.setAttribute('data-badge-hidden', 'true')
      })
    }
    run(false)
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => run(true))
    observer.observe(slot)
    slot.querySelectorAll('[data-badge-zone]').forEach((z) => observer.observe(z))
    return () => observer.disconnect()
  })
}
