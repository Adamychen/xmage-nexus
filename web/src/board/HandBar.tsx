import { useEffect, useMemo, useRef, useState } from 'react'
import type { CardView } from '../net/types'
import CardSlot from './CardSlot'
import { ManaPip, parseManaSymbols } from '../decks/ArenaManaSymbols'
import {
  computeHandArc,
  computeHandBarSizing,
  computeHandHoverScale,
  computeHandSideReserve,
  handFanSpill,
  computeCostPipLayout,
  computeCostPipSize,
  handLandsGap,
  handRestHeight,
  handRestStripWidth,
  type HandSideReserve,
  HAND_ARC_PLAYABLE_RISE_PX,
  HAND_BAR_MAX_CARD_W,
  HAND_BAR_PANEL_GAP_PX,
  HAND_BAR_PEEK_RATIO,
  HAND_BAR_REST_OVERLAP_RATIO,
  HAND_CARD_ASPECT,
  HAND_BAR_PADDING_Y,
} from './handSizing'
import { costWithCommanderTax } from './commanders'
import { handDropIndex, moveHandCard, reconcileHandOrder } from './handOrder'
import { useDrawSlide } from './useDrawSlide'
import { useSettings } from '../state/store'
import type { HandTrailingCard } from './handCommander'
import './HandBar.css'
import './drawSlide.css'

const HAND_DRAG_THRESHOLD_PX = 8
const NO_TRAILING: HandTrailingCard[] = []
/** Side panels the hand must not cover: the bottom-left player panel (its mana pool row) and the command wheel. */
const HAND_SIDE_PANELS = '.pz-bottom-row:not(.arena-own-row), [data-testid="game-dock"], .spotlight-panel, .hand-side-panel'
const SCALED_COPY = '.spotlight-copy'
const SPOTLIGHT_MAIN_ROW = '.spotlight-main .pz-bottom-row'
import './targetZone.css'

/** Mana cost as bubbles over the card's top edge (split cards show both halves): what casting the
 *  card costs now, so a commander's tax is already in it (BRD-34). Other modifiers are not, because
 *  the server never sends a card's modified cost. They sit at the left of the card, in the strip the
 *  next card leaves uncovered, and a long cost stacks its bubbles to stay inside that strip. */
function HandCardCost({ card, pipSize, stripW, tax = 0 }: { card: CardView; pipSize: number; stripW: number; tax?: number }) {
  if (card.faceDown) return null
  const printed = [...(card.manaCostLeftStr ?? []), ...(card.manaCostRightStr ?? [])].flatMap((s) => (s.includes('{') ? parseManaSymbols(s) : [s]))
  const symbols = costWithCommanderTax(printed, tax)
  if (symbols.length === 0) return null
  const { step } = computeCostPipLayout(stripW, pipSize, symbols.length)
  return (
    <div className="hand-card-cost" aria-hidden="true">
      <div className="hand-card-cost-pips" style={{ '--pip-overlap': `${step - pipSize}px` } as React.CSSProperties}>
        {symbols.map((sym, i) => (
          <ManaPip key={`${sym}-${i}`} symbol={sym} size={pipSize} />
        ))}
      </div>
    </div>
  )
}

interface HandBarProps {
  cards: Record<string, CardView>
  onCardClick?: (id: string) => void
  onHover?: (card: CardView | null, rect?: DOMRect) => void
  playableIds?: Set<string>
  targetIds?: Set<string>
  /** Keeps the whole hand lifted (opening-hand decision). */
  raised?: boolean
  /** Slot above the hand where prompts about the hand (mulligan) are portaled. */
  promptSlotRef?: (el: HTMLElement | null) => void
  /** BRD-32: drawn apart after the fan, like more cards (the own commander, with its tax). */
  trailing?: HandTrailingCard[]
  onTrailingClick?: (id: string) => void
}

export default function HandBar({
  cards,
  onCardClick,
  onHover,
  playableIds = new Set(),
  targetIds = new Set(),
  raised = false,
  promptSlotRef,
  trailing = NO_TRAILING,
  onTrailingClick,
}: HandBarProps) {
  const { showHandCost: showHandCostSetting, cardRender } = useSettings()
  const showHandCost = showHandCostSetting && cardRender !== 'rendered'
  const serverIds = Object.keys(cards)
  const [order, setOrder] = useState<string[]>(serverIds)
  const orderedIds = reconcileHandOrder(order, serverIds)
  const orderedIdsRef = useRef(orderedIds)
  const entries = orderedIds.map((id) => [id, cards[id]] as const)
  const zoneRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ id: string; pointerId: number; startX: number; startY: number; active: boolean } | null>(null)
  const suppressClickRef = useRef(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const drawn = useDrawSlide(zoneRef, serverIds, !raised, { scope: '.board-shell', select: '.resource-bar.my .library-chip, .resource-bar.my .library-stack' })

  useEffect(() => {
    orderedIdsRef.current = orderedIds
  })

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || e.pointerId !== drag.pointerId) return
      if (!drag.active) {
        if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < HAND_DRAG_THRESHOLD_PX) return
        drag.active = true
        setDraggingId(drag.id)
      }
      const zone = zoneRef.current
      if (!zone) return
      const centers = Array.from(zone.querySelectorAll<HTMLElement>('.hand-card-slot[data-hand-id]'))
        .filter((slot) => slot.dataset.handId !== drag.id)
        .map((slot) => {
          const r = (slot.querySelector('.hand-card') ?? slot).getBoundingClientRect()
          return r.left + r.width / 2
        })
      const current = orderedIdsRef.current
      const next = moveHandCard(current, drag.id, handDropIndex(e.clientX, centers))
      if (next.some((id, i) => id !== current[i])) {
        orderedIdsRef.current = next
        setOrder(next)
      }
    }
    const onUp = (e: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || e.pointerId !== drag.pointerId) return
      dragRef.current = null
      if (!drag.active) return
      suppressClickRef.current = true
      setDraggingId(null)
      window.setTimeout(() => {
        suppressClickRef.current = false
      }, 0)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [])
  const [cardW, setCardW] = useState(HAND_BAR_MAX_CARD_W)
  const [gap, setGap] = useState(0)
  const [sideReserve, setSideReserve] = useState<HandSideReserve>({ left: 0, right: 0 })
  const clearRef = useRef<HandSideReserve>({ left: 0, right: 0 })
  const panelRectsRef = useRef<DOMRect[]>([])
  const measureRef = useRef<(() => void) | null>(null)
  const [hoverScale, setHoverScale] = useState(1.5)
  const [viewportH, setViewportH] = useState<number | null>(null)
  const arcEntries = useMemo(() => computeHandArc(entries.length, cardW), [entries.length, cardW])
  const restH = handRestHeight(cardW, arcEntries.map((arc) => ({ rot: arc.rot, rise: arc.rise + HAND_ARC_PLAYABLE_RISE_PX })), 0)
  const reserveScopeRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (restH === 0) {
      reserveScopeRef.current?.style.removeProperty('--hand-reserve')
      return
    }
    const el = zoneRef.current
    const scope = el?.closest<HTMLElement>('.board-wrap')
    if (!el || !scope || viewportH === null) return
    reserveScopeRef.current = scope
    const paddingBottom = parseFloat(getComputedStyle(el).paddingBottom) || 0
    scope.style.setProperty('--hand-reserve', `${Math.ceil(restH + paddingBottom) + handLandsGap(viewportH)}px`)
  }, [restH, viewportH])

  useEffect(() => () => { reserveScopeRef.current?.style.removeProperty('--hand-reserve') }, [])

  useEffect(() => {
    const el = zoneRef.current
    if (!el || entries.length === 0) return
    const host = el.parentElement ?? el
    const scope = el.closest<HTMLElement>('.board-wrap') ?? host

    const measure = () => {
      const hostRect = host.getBoundingClientRect()
      if (hostRect.width <= 0) return
      const barRect = el.getBoundingClientRect()
      const panels = Array.from(scope.querySelectorAll<HTMLElement>(HAND_SIDE_PANELS))
        .filter((panel) => !panel.closest(SCALED_COPY) && !panel.matches(SPOTLIGHT_MAIN_ROW))
        .map((panel) => panel.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.top < barRect.bottom && r.bottom > barRect.top)
      const base = computeHandSideReserve({ left: hostRect.left, right: hostRect.right }, panels)
      const spill = handFanSpill(entries.length, HAND_BAR_MAX_CARD_W)
      const trailingSpill = trailing.length > 0 ? Math.ceil(HAND_BAR_MAX_CARD_W * 0.2) : 0
      const reserve = {
        left: base.left > 0 ? base.left + spill + clearRef.current.left : 0,
        right: base.right > 0 ? base.right + (trailing.length > 0 ? trailingSpill : spill) + clearRef.current.right : 0,
      }
      panelRectsRef.current = panels
      const availW = hostRect.width - reserve.left - reserve.right
      if (availW <= 0) return
      const sizing = computeHandBarSizing(availW, entries.length + (trailing.length > 0 ? trailing.length + 1 : 0))
      setSideReserve(reserve)
      setCardW(sizing.cardW)
      setGap(sizing.gap)
      setHoverScale(computeHandHoverScale(sizing.cardW, window.innerHeight))
      setViewportH(window.innerHeight)
    }

    measureRef.current = measure
    measure()
    window.addEventListener('resize', measure)
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    ro?.observe(host)
    scope.querySelectorAll<HTMLElement>(HAND_SIDE_PANELS).forEach((panel) => {
      if (!panel.closest(SCALED_COPY)) ro?.observe(panel)
    })
    const mo = typeof MutationObserver === 'undefined' ? null : new MutationObserver(measure)
    mo?.observe(scope, { childList: true })
    return () => {
      window.removeEventListener('resize', measure)
      ro?.disconnect()
      mo?.disconnect()
    }
  }, [entries.length, trailing.length])

  // BRD-32: the outer cards of the drawn fan (rotation, overlap, the commander's gap) must clear the
  // side panels. Once the fan has settled (its slide lasts 0.25 s) an overlap still measured widens
  // that side's reserve by it, at most a few times per hand.
  const clearPassesRef = useRef(0)
  useEffect(() => {
    clearRef.current = { left: 0, right: 0 }
    clearPassesRef.current = 0
  }, [entries.length, trailing.length])
  useEffect(() => {
    const el = zoneRef.current
    if (!el || panelRectsRef.current.length === 0 || clearPassesRef.current >= 3) return
    const timer = window.setTimeout(() => {
      const cards = Array.from(el.querySelectorAll<HTMLElement>('.hand-card')).map((c) => c.getBoundingClientRect())
      if (cards.length === 0) return
      const left = Math.min(...cards.map((r) => r.left))
      const right = Math.max(...cards.map((r) => r.right))
      const bar = el.getBoundingClientRect()
      const mid = (bar.left + bar.right) / 2
      let addL = 0
      let addR = 0
      for (const p of panelRectsRef.current) {
        if ((p.left + p.right) / 2 < mid) addL = Math.max(addL, Math.ceil(p.right + HAND_BAR_PANEL_GAP_PX / 2 - left))
        else addR = Math.max(addR, Math.ceil(right + HAND_BAR_PANEL_GAP_PX / 2 - p.left))
      }
      if (addL <= 0 && addR <= 0) return
      clearPassesRef.current += 1
      clearRef.current = { left: clearRef.current.left + Math.max(0, addL), right: clearRef.current.right + Math.max(0, addR) }
      measureRef.current?.()
    }, 320)
    return () => window.clearTimeout(timer)
  }, [cardW, gap, sideReserve])

  if (entries.length === 0 && trailing.length === 0) return null

  const cardH = cardW * HAND_CARD_ASPECT
  const stripW = handRestStripWidth(cardW, gap)
  const pipSize = computeCostPipSize(stripW, cardW)
  const isTargetZone = entries.some(([id]) => targetIds.has(id))

  return (
    <div
      ref={zoneRef}
      className={`hand-bar${raised ? ' is-raised' : ''}${isTargetZone ? ' target-zone' : ''}${draggingId ? ' is-reordering' : ''}`}
      data-testid="hand-bar"
      data-hand-count={entries.length}
      style={
        {
          left: `${sideReserve.left}px`,
          right: `${sideReserve.right}px`,
          '--card-w': `${cardW}px`,
          '--hand-gap': `${gap}px`,
          '--hand-rest-overlap': HAND_BAR_REST_OVERLAP_RATIO,
          '--hover-scale': hoverScale,
          '--sink': `${cardH * HAND_BAR_PEEK_RATIO}px`,
          height: `${cardH * HAND_BAR_PEEK_RATIO + HAND_BAR_PADDING_Y}px`,
        } as React.CSSProperties
      }
    >
      {entries.map(([id, card], i) => {
        const arc = arcEntries[i] ?? { rot: 0, rise: 0 }
        const draw = drawn.get(id)
        const isInteractive = playableIds.has(id) || targetIds.has(id)
        const rise = arc.rise + (isInteractive ? HAND_ARC_PLAYABLE_RISE_PX : 0)
        return (
          <div
            key={id}
            className={`hand-card-slot${draggingId === id ? ' is-dragging' : ''}${draw ? ` draw-${draw}` : ''}`}
            data-hand-id={id}
            style={{ '--rot': `${arc.rot}deg`, '--rise': `${rise}px` } as React.CSSProperties}
            onMouseEnter={onHover ? (e) => onHover(card, e.currentTarget.getBoundingClientRect()) : undefined}
            onMouseLeave={onHover ? () => onHover(null) : undefined}
            onFocus={onHover ? (e) => onHover(card, e.currentTarget.getBoundingClientRect()) : undefined}
            onBlur={onHover ? () => onHover(null) : undefined}
            onPointerDown={(e) => {
              if (e.button !== 0 || entries.length < 2) return
              dragRef.current = { id, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, active: false }
            }}
          >
            <CardSlot
              cardId={id}
              card={card}
              onClick={
                onCardClick
                  ? () => {
                      if (suppressClickRef.current) return
                      onCardClick(id)
                    }
                  : undefined
              }
              isPlayable={playableIds.has(id)}
              isTarget={targetIds.has(id)}
              className="hand-card"
            />
            {showHandCost && <HandCardCost card={card} pipSize={pipSize} stripW={stripW} />}
          </div>
        )
      })}
      {trailing.map((item, i) => (
        <div
          key={item.id}
          className={`hand-card-slot hand-trailing${i === 0 ? ' is-first' : ''}`}
          data-testid="hand-trailing"
          data-trailing-id={item.id}
          style={{ '--rot': '0deg', '--rise': `${playableIds.has(item.id) ? HAND_ARC_PLAYABLE_RISE_PX : 0}px` } as React.CSSProperties}
          onMouseEnter={onHover ? (e) => onHover(item.card, e.currentTarget.getBoundingClientRect()) : undefined}
          onMouseLeave={onHover ? () => onHover(null) : undefined}
        >
          <CardSlot
            cardId={item.id}
            card={item.card}
            onClick={onTrailingClick ? () => onTrailingClick(item.id) : undefined}
            isPlayable={playableIds.has(item.id)}
            isTarget={targetIds.has(item.id)}
            className="hand-card hand-trailing-card"
          />
          {showHandCost && <HandCardCost card={item.card} pipSize={pipSize} stripW={cardW} tax={item.tax} />}
        </div>
      ))}
      {promptSlotRef && <div className="hand-bar-prompt" ref={promptSlotRef} />}
    </div>
  )
}
