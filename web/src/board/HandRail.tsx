import { useMemo, useState } from 'react'
import type { CardView } from '../net/types'
import CardSlot from './CardSlot'
import IconButton from '../ui/IconButton'
import { activeCardFace } from './cardFaces'
import RenderedCard from '../cards/rendered/RenderedCard'
import { useSettings } from '../state/store'
import { useTranslation } from '../i18n'
import './HandRail.css'

interface HandRailProps {
  cards: Record<string, CardView>
  onCardClick?: (id: string) => void
  playableIds?: Set<string>
  targetIds?: Set<string>
}

function hasBackFace(card: CardView): boolean {
  return !card.faceDown && (!!card.secondCardFace || !!card.alternateName)
}

export default function HandRail({ cards, onCardClick, playableIds = new Set(), targetIds = new Set() }: HandRailProps) {
  const { t } = useTranslation()
  const { cardRender, handRailWidth } = useSettings()
  const entries = useMemo(() => Object.entries(cards), [cards])
  const [flipped, setFlipped] = useState<Set<string>>(new Set())
  const toggleFlip = (id: string) =>
    setFlipped((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })
  if (entries.length === 0) return null
  return (
    <aside
      className="hand-rail"
      data-testid="hand-rail"
      data-hand-count={entries.length}
      aria-label={t('game', 'hand_rail_label')}
      style={{ '--hand-rail-w': `${handRailWidth}px`, '--card-w': `${handRailWidth - 24}px` } as React.CSSProperties}
    >
      {entries.map(([id, card]) => {
        const playable = playableIds.has(id)
        const target = targetIds.has(id)
        const state = `${playable ? ' playable' : ''}${target ? ' targetable' : ''}`
        if (cardRender === 'rendered') {
          return (
            <div
              key={id}
              role={onCardClick ? 'button' : undefined}
              tabIndex={onCardClick ? 0 : undefined}
              className={`hand-rail-card hand-rail-card--rendered${state}`}
              data-hand-id={id}
              onClick={onCardClick ? () => onCardClick(id) : undefined}
              onKeyDown={onCardClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCardClick(id) } } : undefined}
            >
              <RenderedCard card={flipped.has(id) ? (activeCardFace(card, true) as CardView) : card} />
              {hasBackFace(card) && (
                <IconButton
                  label={t('wiki', 'flip_hint')}
                  icon="refresh"
                  size="sm"
                  round
                  className="hand-rail-flip"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleFlip(id)
                  }}
                />
              )}
            </div>
          )
        }
        return (
          <div key={id} className={`hand-rail-card${state}`} data-hand-id={id}>
            <CardSlot
              cardId={id}
              card={card}
              onClick={onCardClick ? () => onCardClick(id) : undefined}
              isPlayable={playable}
              isTarget={target}
              className="hand-card"
            />
          </div>
        )
      })}
    </aside>
  )
}
