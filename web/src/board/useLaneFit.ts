import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { chooseLaneFit, chooseRingFit, type LaneFit, type RingFit } from './laneFit'

function px(value: string): number {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

/**
 * Measures a row of seats against the room the band gives it and picks the widest rung that fits
 * (see `laneFit.ts`), for the 1v1 walkway (`useLaneFit`) and the pod ring (`useRingFit`) alike.
 * Neither ever clips a name.
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
function useMeasuredFit<T extends string>(
  enabled: boolean,
  key: string,
  pick: (need: (name: string) => number | null, avail: number, pad: number) => T,
): {
  ref: (el: HTMLElement | null) => void
  fit: T
} {
  const elRef = useRef<HTMLElement | null>(null)
  const [fit, setFit] = useState<T>(() => pick(() => null, 0, 0))

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
    const need = (name: string) => el.querySelector<HTMLElement>(`[data-lane-measure="${name}"]`)?.offsetWidth ?? null
    if (need('full') === null) return
    const next = pick(need, avail, pad)
    setFit((prev) => (prev === next ? prev : next))
  }, [pick])

  useLayoutEffect(() => {
    if (!enabled) {
      setFit(() => pick(() => null, 0, 0))
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
  }, [enabled, key, apply, pick])

  return { ref, fit }
}

export function useLaneFit(enabled: boolean, key: string): {
  ref: (el: HTMLElement | null) => void
  fit: LaneFit
} {
  const pick = useCallback((need: (name: string) => number | null, avail: number, pad: number): LaneFit => {
    const full = need('full') ?? 0
    const needAll = full + pad
    const needActive = (need('solo') ?? needAll / 2) + pad
    const needActiveDots = (need('solo-dots') ?? Math.max(8, needActive - 60)) + pad
    return chooseLaneFit({ needAll, needActive, needActiveDots, avail })
  }, [])
  return useMeasuredFit<LaneFit>(enabled, key, pick)
}

/**
 * The pod ring's own ladder (BRD-37): the whole row, the row with its spacing tightened, or the
 * row with the names of the seats that are not playing dropped. Same reason as the walkway's: a
 * seat name is never clipped, and which rung fits depends on the font the platform resolves for
 * `--font-ui`, so it is measured against hidden clones, not against a width tuned on one machine.
 */
export function useRingFit(enabled: boolean, key: string): {
  ref: (el: HTMLElement | null) => void
  fit: RingFit
} {
  const pick = useCallback((need: (name: string) => number | null, avail: number, pad: number): RingFit => {
    const full = need('full') ?? 0
    return chooseRingFit({ needFull: full + pad, needTight: (need('tight') ?? full) + pad, avail })
  }, [])
  return useMeasuredFit<RingFit>(enabled, key, pick)
}
