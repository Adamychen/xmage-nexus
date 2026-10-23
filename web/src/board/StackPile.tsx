import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { spreadLayout } from './stackSpread'
import { BOARD_RELAYOUT_EVENT } from './useBandFit'

const SPREAD_GAP = 6
const BAND_EDGE = 4
const SPREAD_SETTLE_MS = 250

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
  const after = followers(pile)
  const restRight = after.reduce(
    (right, el) => Math.max(right, el.getBoundingClientRect().right - (parseFloat(getComputedStyle(el).left) || 0) * scale),
    pileRect.right,
  )
  const room = Math.max(0, bandRect.right - edge - restRight)
  const layout = spreadLayout(collapsed, SPREAD_GAP * scale, bandRect.left + edge, pileRect.right + room)
  items.forEach((el, i) => el.style.setProperty('--spread-x', `${layout.dx[i] / scale}px`))
  pile.style.setProperty('--spread-l', `${(layout.stripLeft - pileRect.left) / scale}px`)
  pile.style.setProperty('--spread-w', `${layout.stripWidth / scale}px`)
  const push = Math.max(0, layout.stripLeft + layout.stripWidth - pileRect.right) / scale
  for (const el of after) {
    el.dataset.spreadPushed = ''
    el.style.setProperty('--spread-push', `${push}px`)
  }
  pile.dataset.spread = ''
}

function announceRelayout(): void {
  window.dispatchEvent(new Event(BOARD_RELAYOUT_EVENT))
}

function announceSettledRelayout(): void {
  announceRelayout()
  setTimeout(announceRelayout, SPREAD_SETTLE_MS)
}

function followers(pile: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = []
  for (let el = pile.nextElementSibling; el; el = el.nextElementSibling) out.push(el as HTMLElement)
  return out
}

function unpush(pile: HTMLElement): void {
  for (const el of followers(pile)) {
    delete el.dataset.spreadPushed
    el.style.removeProperty('--spread-push')
  }
}

function collapse(pile: HTMLElement): void {
  delete pile.dataset.spread
  unpush(pile)
}

function leave(pile: HTMLElement): void {
  if (pile.dataset.spread === undefined) return
  collapse(pile)
  announceSettledRelayout()
}

interface StackPileProps {
  className: string
  name: string
  count: number
  cardIds: string[]
  landName?: string
  children: ReactNode
}

/**
 * Pile of identical permanents that fans out on hover as an overlay: the pile
 * keeps its collapsed footprint (nothing else in the band moves or re-fits) and
 * an invisible strip covers the fanned cards, so the hover area only grows
 * while spread and cannot flip back and forth under a still pointer. The
 * permanents after the pile are shifted aside (visually only) by however far
 * the fan reaches past the pile, so a mana rock beside a land pile is never
 * covered.
 */
export default function StackPile({ className, name, count, cardIds, landName, children }: StackPileProps) {
  const ref = useRef<HTMLDivElement>(null)
  const cardKey = cardIds.join('|')

  const refresh = useCallback(() => {
    const pile = ref.current
    if (pile && pile.dataset.spread !== undefined) spread(pile)
  }, [])

  useLayoutEffect(() => refresh(), [refresh, cardKey])

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
      onPointerEnter={(e) => {
        spread(e.currentTarget)
        announceSettledRelayout()
      }}
      onPointerLeave={(e) => leave(e.currentTarget)}
      onMouseLeave={(e) => leave(e.currentTarget)}
    >
      {children}
      <span className="stack-group-badge land-group-badge">×{count}</span>
    </div>
  )
}
