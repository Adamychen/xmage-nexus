import { useLayoutEffect } from 'react'
import { fitBand } from './bandFit'

/** Aviso global de que una banda cambió el tamaño de sus cartas (las flechas de combate recolocan sus extremos). */
export const BOARD_RELAYOUT_EVENT = 'board-relayout'

const MIN_BAND_CARD_W = 46
const MIN_BAND_CARD_W_POD = 38

function px(value: string): number {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

/**
 * Encoge las cartas de una banda (y las reparte en varias líneas si compensa)
 * cuando no caben al tamaño que calcula la zona, en vez de obligar a hacer
 * scroll horizontal. Escribe `--card-w` directamente en la banda (los hijos lo
 * heredan) y marca `data-band-lines`; el scroll solo queda por debajo del suelo.
 */
export function useBandFit(el: HTMLElement | null, baseW: number, compact: boolean): void {
  useLayoutEffect(() => {
    if (!el) return

    let rafId: number | null = null
    let applied = -1
    let initialized = false
    const minW = compact ? MIN_BAND_CARD_W_POD : MIN_BAND_CARD_W

    const apply = (cardW: number, lines: number) => {
      let changed = false
      const shrunk = cardW < baseW
      if (!shrunk) {
        if (applied !== -1) {
          el.style.removeProperty('--card-w')
          changed = true
        }
        applied = -1
      } else if (cardW !== applied) {
        el.style.setProperty('--card-w', `${cardW}px`)
        applied = cardW
        changed = true
      }
      const attr = shrunk && lines > 1 ? String(lines) : ''
      if ((el.getAttribute('data-band-lines') ?? '') !== attr) {
        if (attr) el.setAttribute('data-band-lines', attr)
        else el.removeAttribute('data-band-lines')
        changed = true
      }
      if (changed && initialized) window.dispatchEvent(new Event(BOARD_RELAYOUT_EVENT))
    }

    const measure = () => {
      const style = getComputedStyle(el)
      const availW = el.clientWidth - px(style.paddingLeft) - px(style.paddingRight)
      const availH = el.clientHeight - px(style.paddingTop) - px(style.paddingBottom)
      const children = Array.from(el.children) as HTMLElement[]
      if (children.length === 0 || availW <= 0 || availH <= 0) {
        apply(baseW, 1)
        return
      }

      let contentW = 0
      for (const child of children) {
        const cs = getComputedStyle(child)
        contentW += child.offsetWidth + px(cs.marginLeft) + px(cs.marginRight)
      }
      if (contentW <= 0) return

      const measuredW = applied === -1 ? baseW : applied
      const fit = fitBand({
        measuredW,
        contentW,
        itemCount: children.length,
        gap: px(style.columnGap),
        availW,
        availH,
        maxW: baseW,
        minW,
      })
      apply(fit.cardW, fit.lines)
    }

    const schedule = () => {
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        measure()
      })
    }

    measure()
    initialized = true

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null
    ro?.observe(el)
    const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(schedule) : null
    mo?.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      ro?.disconnect()
      mo?.disconnect()
      el.style.removeProperty('--card-w')
      el.removeAttribute('data-band-lines')
    }
  }, [el, baseW, compact])
}
