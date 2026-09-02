import { useEffect, useMemo, useRef, useState } from 'react'
import type { CardView } from '../net/types'
import CardSlot from './CardSlot'
import {
  computeHandArc,
  computeHandBarSizing,
  HAND_ARC_PLAYABLE_RISE_PX,
  HAND_BAR_MAX_CARD_W,
  HAND_BAR_PEEK_RATIO,
  HAND_CARD_ASPECT,
  HAND_BAR_PADDING_Y,
} from './handSizing'
import './HandBar.css'

interface HandBarProps {
  cards: Record<string, CardView>
  onCardClick?: (id: string) => void
  playableIds?: Set<string>
  targetIds?: Set<string>
}

export default function HandBar({
  cards,
  onCardClick,
  playableIds = new Set(),
  targetIds = new Set(),
}: HandBarProps) {
  const entries = Object.entries(cards)
  const zoneRef = useRef<HTMLDivElement | null>(null)
  const [cardW, setCardW] = useState(HAND_BAR_MAX_CARD_W)
  const [gap, setGap] = useState(0)
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
    }

    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [entries.length])

  if (entries.length === 0) return null

  const cardH = cardW * HAND_CARD_ASPECT

  return (
    <div
      ref={zoneRef}
      className="hand-bar"
      data-testid="hand-bar"
      style={
        {
          '--card-w': `${cardW}px`,
          '--hand-gap': `${gap}px`,
          '--sink': `${cardH * HAND_BAR_PEEK_RATIO}px`,
          height: `${cardH * HAND_BAR_PEEK_RATIO + HAND_BAR_PADDING_Y}px`,
        } as React.CSSProperties
      }
    >
      {entries.map(([id, card], i) => {
        const arc = arcEntries[i] ?? { rot: 0, rise: 0 }
        const rise = arc.rise + (playableIds.has(id) ? HAND_ARC_PLAYABLE_RISE_PX : 0)
        return (
          <div
            key={id}
            className="hand-card-slot"
            style={{ '--rot': `${arc.rot}deg`, '--rise': `${rise}px` } as React.CSSProperties}
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
        )
      })}
    </div>
  )
}
