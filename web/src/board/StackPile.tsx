import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { spreadLayout } from './stackSpread'
import { BOARD_RELAYOUT_EVENT } from './useBandFit'

const SPREAD_GAP = 6
const BAND_EDGE = 4

function pileItems(pile: HTMLElement): HTMLElement[] {
  return (Array.from(pile.children) as HTMLElement[]).filter((c) => !c.classList.contains('stack-group-badge'))
}

function spread(pile: HTMLElement): void {
  const band = pile.parentElement
  const pileRect = pile.getBoundingClientRect()
  if (!band || pile.offsetWidth === 0) return
  const scale = pileRect.width / pile.offsetWidth || 1
  const items = pileItems(pile)
  const collapsed = items.map((el) => {
    const r = el.getBoundingClientRect()
    const current = parseFloat(getComputedStyle(el).left) || 0
    return { left: r.left - current * scale, width: r.width }
  })
  const bandRect = band.getBoundingClientRect()
  const edge = BAND_EDGE * scale
  const layout = spreadLayout(collapsed, SPREAD_GAP * scale, bandRect.left + edge, bandRect.right - edge)
  items.forEach((el, i) => el.style.setProperty('--spread-x', `${layout.dx[i] / scale}px`))
  pile.style.setProperty('--spread-l', `${(layout.stripLeft - pileRect.left) / scale}px`)
  pile.style.setProperty('--spread-w', `${layout.stripWidth / scale}px`)
  pile.dataset.spread = ''
}

function collapse(pile: HTMLElement): void {
  delete pile.dataset.spread
}

interface StackPileProps {
  className: string
  name: string
  count: number
  landName?: string
  children: ReactNode
}

/**
 * Pile of identical permanents that fans out on hover as an overlay: the pile
 * keeps its collapsed footprint (nothing else in the band moves or re-fits) and
 * an invisible strip covers the fanned cards, so the hover area only grows
 * while spread and cannot flip back and forth under a still pointer.
 */
export default function StackPile({ className, name, count, landName, children }: StackPileProps) {
  const ref = useRef<HTMLDivElement>(null)

  const refresh = useCallback(() => {
    const pile = ref.current
    if (pile && pile.dataset.spread !== undefined) spread(pile)
  }, [])

  useLayoutEffect(refresh)

  useEffect(() => {
    window.addEventListener(BOARD_RELAYOUT_EVENT, refresh)
    window.addEventListener('resize', refresh)
    return () => {
      window.removeEventListener(BOARD_RELAYOUT_EVENT, refresh)
      window.removeEventListener('resize', refresh)
    }
  }, [refresh])

  return (
    <div
      ref={ref}
      className={className}
      data-stack-name={name}
      data-count={count}
      data-land-name={landName}
      title={`${name} (×${count})`}
      onPointerEnter={(e) => spread(e.currentTarget)}
      onPointerLeave={(e) => collapse(e.currentTarget)}
    >
      {children}
      <span className="stack-group-badge land-group-badge">×{count}</span>
    </div>
  )
}
