import EmptyState from '../ui/EmptyState'
import { useMemo, useState } from 'react'
import type { CardView, PermanentView } from '../net/types'
import CardSlot from './CardSlot'
import FloatingCardPreview from './FloatingCardPreview'
import ZoneViewer from './ZoneViewer'
import { useTranslation } from '../i18n'

interface HandViewerProps {
  playerName: string
  known: Array<[string, CardView]>
  unknownCount: number
  targetIds?: Set<string>
  playableIds?: Set<string>
  onCardClick?: (id: string) => void
  onClose: () => void
}

export default function HandViewer({
  playerName,
  known,
  unknownCount,
  targetIds,
  playableIds,
  onCardClick,
  onClose,
}: HandViewerProps) {
  const { t } = useTranslation()
  const targetSet = useMemo(() => targetIds ?? new Set<string>(), [targetIds])
  const playableSet = useMemo(() => playableIds ?? new Set<string>(), [playableIds])
  const [hoverCard, setHoverCard] = useState<CardView | null>(null)
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null)

  const handleCardHover = (card: CardView | PermanentView | null, rect?: DOMRect) => {
    setHoverCard(card ?? null)
    setHoverRect(rect ?? null)
  }

  const total = known.length + unknownCount

  return (
    <ZoneViewer
      title={`${t('game', 'pile_hand')} · ${playerName}`}
      count={t('game', 'opp_hand_view', { known: known.length, count: total })}
      className="hand-viewer"
      testId="hand-viewer"
      itemCount={total}
      onClose={onClose}
      after={(
        <FloatingCardPreview
          card={hoverCard}
          anchorRect={hoverRect}
          fixedSide="left"
          inModal
        />
      )}
    >
          {known.map(([id, card], index) => {
            const clickable = (targetSet.has(id) || playableSet.has(id)) && onCardClick
            return (
              <div
                key={id}
                className="pile-card-wrapper zone-fan-item is-revealed"
                onFocus={(e) => handleCardHover(card, (e.target as HTMLElement).getBoundingClientRect())}
                onBlur={() => handleCardHover(null)}
              >
                <div className="pile-position-badge">#{index + 1}</div>
                <CardSlot
                  cardId={id}
                  card={card}
                  className="pile-card"
                  isTarget={targetSet.has(id)}
                  isPlayable={playableSet.has(id)}
                  onClick={clickable ? () => onCardClick!(id) : undefined}
                  onHover={handleCardHover}
                />
              </div>
            )
          })}
          {Array.from({ length: unknownCount }, (_, i) => (
            <div key={`hv-back-${i}`} className="pile-card-wrapper zone-fan-item" data-testid="hand-viewer-back" data-index={known.length + i + 1}>
              <div className="pile-position-badge">#{known.length + i + 1}</div>
              <CardSlot card={{ id: `hv-back-${i}`, name: '?', manaValue: 0, expansionSetCode: '', cardNumber: '0' }} faceDown className="pile-card" />
            </div>
          ))}
          {known.length === 0 && unknownCount === 0 && (
            <EmptyState>{t('game', 'pile_hand')}</EmptyState>
          )}
    </ZoneViewer>
  )
}
