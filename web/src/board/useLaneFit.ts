import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { chooseLaneFit, type LaneFit } from './laneFit'

function px(value: string): number {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

/**
 * Measures the walkway against the room the band gives it and picks the widest
 * layout that fits (see `laneFit.ts`): the whole row, the active seat alone, or
 * dots only. It never clips a name.
 *
 * The numbers come from hidden clones rendered at natural width
 * (`[data-lane-measure]`, `width: max-content`) because the visible row is
 * already capped by the band: measuring it would read the cap, not the content.
 * It also lets the row grow back when the window does.
 *
 * The room is the *parent's* width, not the walkway's: `.game-strip-center` is
 * `flex: 1`, so its width does not depend on what the walkway renders, which is
 * what stops the measurement from feeding itself (the mistake behind the
 * band-fit flip: see `layout/solveRow.ts`).
 */
export function useLaneFit(enabled: boolean, key: string): {
  ref: (el: HTMLElement | null) => void
  fit: LaneFit
} {
  const elRef = useRef<HTMLElement | null>(null)
  const [fit, setFit] = useState<LaneFit>('full')

  const ref = useCallback((el: HTMLElement | null) => {
    elRef.current = el
  }, [])

  const apply = useCallback(() => {
    const el = elRef.current
    if (!el) return
    const host = el.parentElement
    if (!host) return
    const hostStyle = getComputedStyle(host)
    const elStyle = getComputedStyle(el)
    const avail =
      host.clientWidth -
      px(hostStyle.paddingLeft) -
      px(hostStyle.paddingRight) -
      px(elStyle.marginLeft) -
      px(elStyle.marginRight)
    if (avail <= 0) return
    const pad = px(elStyle.paddingLeft) + px(elStyle.paddingRight)
    const measure = (name: string) => el.querySelector<HTMLElement>(`[data-lane-measure="${name}"]`)
    const full = measure('full')
    if (!full) return
    const solo = measure('solo')
    const soloDots = measure('solo-dots')
    const needAll = full.offsetWidth + pad
    const needActive = (solo?.offsetWidth ?? needAll / 2) + pad
    const needActiveDots = (soloDots?.offsetWidth ?? Math.max(8, needActive - 60)) + pad
    const next = chooseLaneFit({ needAll, needActive, needActiveDots, avail })
    setFit((prev) => (prev === next ? prev : next))
  }, [])

  useLayoutEffect(() => {
    if (!enabled) {
      setFit('full')
      return
    }
    if (!elRef.current) return
    apply()
    // Names arrive with the game view and the webfont lands after the first
    // paint; both change the natural width without resizing anything.
    const settle = window.setTimeout(apply, 80)
    const second = window.setTimeout(apply, 260)

    let rafId: number | null = null
    const schedule = () => {
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        apply()
      })
    }
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null
    if (ro && elRef.current?.parentElement) ro.observe(elRef.current.parentElement)
    void document.fonts?.ready.then(apply)

    return () => {
      window.clearTimeout(settle)
      window.clearTimeout(second)
      if (rafId !== null) cancelAnimationFrame(rafId)
      ro?.disconnect()
    }
    // `key` is the roster + active seat: the same room with a different set of
    // names is a different fit, and nothing else tells the layout about it.
  }, [enabled, key, apply])

  return { ref, fit }
}
