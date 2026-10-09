import { useEffect, useMemo, useRef, useState } from 'react'
import type { CardView } from '../net/types'
import CardSlot from './CardSlot'
import { ManaPip, parseManaSymbols } from '../decks/ArenaManaSymbols'
import {
  computeHandArc,
  computeHandBarSizing,
  computeHandHoverScale,
  computeCostPipSize,
  handRestStripWidth,
  HAND_ARC_PLAYABLE_RISE_PX,
  HAND_BAR_MAX_CARD_W,
  HAND_BAR_PEEK_RATIO,
  HAND_BAR_REST_OVERLAP_RATIO,
  HAND_CARD_ASPECT,
  HAND_BAR_PADDING_Y,
} from './handSizing'
import { handDropIndex, moveHandCard, reconcileHandOrder } from './handOrder'
import { useSettings } from '../state/store'
import './HandBar.css'

const HAND_DRAG_THRESHOLD_PX = 8
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
  const { showHandCost } = useSettings()
  const serverIds = Object.keys(cards)
  const [order, setOrder] = useState<string[]>(serverIds)
  const orderedIds = reconcileHandOrder(order, serverIds)
  const orderedIdsRef = useRef(orderedIds)
  const entries = orderedIds.map((id) => [id, cards[id]] as const)
  const zoneRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ id: string; pointerId: number; startX: number; startY: number; active: boolean } | null>(null)
  const suppressClickRef = useRef(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)

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
  const [hoverScale, setHoverScale] = useState(1.5)
  const arcEntries = useMemo(() => computeHandArc(entries.length, cardW), [entries.length, cardW])

  useEffect(() => {
    const el = zoneRef.current
    if (!el || entries.length === 0) return

    const measure = () => {
      const availW = el.getBoundingClientRect().width
      if (availW <= 0) return
      const sizing = computeHandBarSizing(availW, entries.length)
      setCardW(sizing.cardW)
      setGap(sizing.gap)
      setHoverScale(computeHandHoverScale(sizing.cardW, window.innerHeight))
    }

    measure()
    window.addEventListener('resize', measure)
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    ro?.observe(el)
    return () => {
      window.removeEventListener('resize', measure)
      ro?.disconnect()
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
        const isInteractive = playableIds.has(id) || targetIds.has(id)
        const rise = arc.rise + (isInteractive ? HAND_ARC_PLAYABLE_RISE_PX : 0)
        return (
          <div
            key={id}
            className={`hand-card-slot${draggingId === id ? ' is-dragging' : ''}`}
            data-hand-id={id}
            style={{ '--rot': `${arc.rot}deg`, '--rise': `${rise}px` } as React.CSSProperties}
            onMouseEnter={onHover ? (e) => onHover(card, e.currentTarget.getBoundingClientRect()) : undefined}
            onMouseLeave={onHover ? () => onHover(null) : undefined}
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
