import { useEffect, useMemo, useRef, useState } from 'react'
import type { CardView } from '../net/types'
import CardSlot from './CardSlot'
import { ManaPip } from '../decks/ArenaManaSymbols'
import {
  computeHandArc,
  computeHandBarSizing,
  computeHandHoverScale,
  computeCostPipLayout,
  computeCostPipSize,
  handRestStripWidth,
  HAND_COST_INSET_PX,
  HAND_ARC_PLAYABLE_RISE_PX,
  HAND_BAR_MAX_CARD_W,
  HAND_BAR_PEEK_RATIO,
  HAND_BAR_REST_OVERLAP_RATIO,
  HAND_CARD_ASPECT,
  HAND_BAR_PADDING_Y,
} from './handSizing'
import './HandBar.css'
import './targetZone.css'

/** Printed mana cost as bubbles over the card's top edge (split cards show
 *  both halves). The server never sends the reduced cost of a card in hand.
 *  At rest the group ends inside the strip this card shows (the next card
 *  covers the rest), stacking its bubbles when the cost is long; the last card
 *  and the hovered one show them spread at the printed corner. */
function HandCardCost({ card, cardW, pipSize, stripW }: { card: CardView; cardW: number; pipSize: number; stripW: number | null }) {
  if (card.faceDown) return null
  const symbols = [...(card.manaCostLeftStr ?? []), ...(card.manaCostRightStr ?? [])]
  if (symbols.length === 0) return null
  const { step } = computeCostPipLayout(stripW ?? Number.POSITIVE_INFINITY, pipSize, symbols.length)
  const style = {
    '--pip-overlap': `${step - pipSize}px`,
    ...(stripW === null ? {} : { '--cost-rest-right': `${Math.max(HAND_COST_INSET_PX, cardW - stripW + HAND_COST_INSET_PX)}px` }),
  } as React.CSSProperties
  return (
    <div className="hand-card-cost" aria-hidden="true">
      <div className="hand-card-cost-pips" style={style}>
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
  const entries = Object.entries(cards)
  const zoneRef = useRef<HTMLDivElement | null>(null)
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
      className={`hand-bar${raised ? ' is-raised' : ''}${isTargetZone ? ' target-zone' : ''}`}
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
            className="hand-card-slot"
            style={{ '--rot': `${arc.rot}deg`, '--rise': `${rise}px` } as React.CSSProperties}
            onMouseEnter={onHover ? (e) => onHover(card, e.currentTarget.getBoundingClientRect()) : undefined}
            onMouseLeave={onHover ? () => onHover(null) : undefined}
          >
            <CardSlot
              cardId={id}
              card={card}
              onClick={onCardClick ? () => onCardClick(id) : undefined}
              isPlayable={playableIds.has(id)}
              isTarget={targetIds.has(id)}
              className="hand-card"
            />
            <HandCardCost card={card} cardW={cardW} pipSize={pipSize} stripW={i < entries.length - 1 ? stripW : null} />
          </div>
        )
      })}
      {promptSlotRef && <div className="hand-bar-prompt" ref={promptSlotRef} />}
    </div>
  )
}
