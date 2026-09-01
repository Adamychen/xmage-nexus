import { useEffect, useRef, useState } from 'react'
import type { CardView } from '../net/types'
import CardSlot from './CardSlot'
import { computeHandBarSizing, HAND_BAR_MAX_CARD_W, HAND_CARD_ASPECT, HAND_BAR_PADDING_Y } from './handSizing'
import './HandBar.css'

export type HandBarOrigin = 'hand-bar'

interface HandBarProps {
  cards: Record<string, CardView>
  onCardClick?: (id: string) => void
  onHover?: (card: CardView | null, rect?: DOMRect, origin?: HandBarOrigin) => void
  playableIds?: Set<string>
  targetIds?: Set<string>
}

export default function HandBar({
  cards,
  onCardClick,
  onHover,
  playableIds = new Set(),
  targetIds = new Set(),
}: HandBarProps) {
  const entries = Object.entries(cards)
  const zoneRef = useRef<HTMLDivElement | null>(null)
  const [cardW, setCardW] = useState(HAND_BAR_MAX_CARD_W)
  const [gap, setGap] = useState(0)

  useEffect(() => {
    const el = zoneRef.current
    if (!el || entries.length === 0) return

    const measure = () => {
      const availW = el.getBoundingClientRect().width
      if (availW <= 0) return
      const sizing = computeHandBarSizing(availW, entries.length)
      setCardW(sizing.cardW)
      setGap(sizing.gap)
    }

    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [entries.length])

  if (entries.length === 0) return null

  return (
    <div
      ref={zoneRef}
      className="hand-bar"
      data-testid="hand-bar"
      style={
        {
          '--card-w': `${cardW}px`,
          '--hand-gap': `${gap}px`,
          height: `${cardW * HAND_CARD_ASPECT + HAND_BAR_PADDING_Y}px`,
        } as React.CSSProperties
      }
    >
      {entries.map(([id, card]) => (
        <div
          key={id}
          className="hand-card-slot"
          onMouseEnter={onHover ? (e) => onHover(card, e.currentTarget.getBoundingClientRect(), 'hand-bar') : undefined}
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
        </div>
      ))}
    </div>
  )
}
