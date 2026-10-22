import { useLayoutEffect, useState, type RefObject } from 'react'
import { BOARD_RELAYOUT_EVENT } from './useBandFit'

function appliedCardW(el: HTMLElement): number | null {
  const w = parseFloat(el.style.getPropertyValue('--card-w'))
  return Number.isFinite(w) && w > 0 ? w : null
}

export function ownBoardCardW(zone: HTMLElement): number | undefined {
  const base = appliedCardW(zone)
  if (base !== null) return base
  const slot = zone.querySelector<HTMLElement>('.card-slot')
  return slot && slot.offsetWidth > 0 ? slot.offsetWidth : undefined
}

export function useOwnCardCap(shell: RefObject<HTMLElement | null>): number | undefined {
  const [cap, setCap] = useState<number | undefined>(undefined)

  useLayoutEffect(() => {
    const root = shell.current
    if (!root) return

    let rafId: number | null = null
    const measure = () => {
      rafId = null
      const zone = root.querySelector<HTMLElement>(':scope > .player-zone')
      const next = zone ? ownBoardCardW(zone) : undefined
      setCap((prev) => (prev === next ? prev : next))
    }
    const schedule = () => {
      if (rafId === null) rafId = requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener(BOARD_RELAYOUT_EVENT, schedule)
    window.addEventListener('resize', schedule)
    const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(schedule) : null
    mo?.observe(root, { subtree: true, attributes: true, attributeFilter: ['style'] })

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      window.removeEventListener(BOARD_RELAYOUT_EVENT, schedule)
      window.removeEventListener('resize', schedule)
      mo?.disconnect()
    }
  }, [shell])

  return cap
}
