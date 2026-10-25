import { useEffect, useMemo, useRef, useState } from 'react'
import type { CardView } from '../net/types'
import CardSlot from './CardSlot'
import { ManaPip, parseManaSymbols } from '../decks/ArenaManaSymbols'
import {
  computeHandArc,
  computeHandBarSizing,
  computeHandHoverScale,
  computeHandSideReserve,
  computeCostPipSize,
  handLandsGap,
  handRestHeight,
  handRestStripWidth,
  type HandSideReserve,
  HAND_ARC_PLAYABLE_RISE_PX,
  HAND_BAR_MAX_CARD_W,
  HAND_BAR_PEEK_RATIO,
  HAND_BAR_REST_OVERLAP_RATIO,
  HAND_CARD_ASPECT,
  HAND_BAR_PADDING_Y,
} from './handSizing'
import { handDropIndex, moveHandCard, reconcileHandOrder } from './handOrder'
import { useDrawSlide } from './useDrawSlide'
import { useSettings } from '../state/store'
import './HandBar.css'
import './drawSlide.css'

const HAND_DRAG_THRESHOLD_PX = 8
/** Side panels the hand must not cover: the bottom-left player panel (its mana pool row) and the command wheel. */
const HAND_SIDE_PANELS = '.pz-bottom-row, [data-testid="game-dock"], .spotlight-panel'
const SCALED_COPY = '.spotlight-copy'
const SPOTLIGHT_MAIN_ROW = '.spotlight-main .pz-bottom-row'
import './targetZone.css'

/** Printed mana cost as bubbles over the card's top edge (split cards show
 *  both halves). The server never sends the reduced cost of a card in hand.
 *  They sit at the printed corner, so on a card the next one overlaps they show
 *  when the card is hovered. */
function HandCardCost({ card, pipSize }: { card: CardView; pipSize: number }) {
  if (card.faceDown) return null
  const symbols = [...(card.manaCostLeftStr ?? []), ...(card.manaCostRightStr ?? [])].flatMap((s) => (s.includes('{') ? parseManaSymbols(s) : [s]))
  if (symbols.length === 0) return null
  return (
    <div className="hand-card-cost" aria-hidden="true">
      <div className="hand-card-cost-pips">
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
}

export default function HandBar({
  cards,
  onCardClick,
  onHover,
  playableIds = new Set(),
  targetIds = new Set(),
  raised = false,
  promptSlotRef,
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
      const centers = Array.from(zone.querySelectorAll<HTMLElement>('.hand-card-slot'))
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
      const reserve = computeHandSideReserve({ left: hostRect.left, right: hostRect.right }, panels)
      const availW = hostRect.width - reserve.left - reserve.right
      if (availW <= 0) return
      const sizing = computeHandBarSizing(availW, entries.length)
      setSideReserve(reserve)
      setCardW(sizing.cardW)
      setGap(sizing.gap)
      setHoverScale(computeHandHoverScale(sizing.cardW, window.innerHeight))
      setViewportH(window.innerHeight)
    }

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
  }, [entries.length])

  if (entries.length === 0) return null

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
            {showHandCost && <HandCardCost card={card} pipSize={pipSize} />}
          </div>
        )
      })}
      {promptSlotRef && <div className="hand-bar-prompt" ref={promptSlotRef} />}
    </div>
  )
}
