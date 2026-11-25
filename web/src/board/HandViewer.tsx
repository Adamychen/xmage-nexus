import EmptyState from '../ui/EmptyState'
import { useMemo } from 'react'
import type { CardView } from '../net/types'
import CardSlot from './CardSlot'
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
  const total = known.length + unknownCount

  return (
    <ZoneViewer
      title={`${t('game', 'pile_hand')} · ${playerName}`}
      count={t('game', 'opp_hand_view', { known: known.length, count: total })}
      className="hand-viewer"
      testId="hand-viewer"
      itemCount={total}
      onClose={onClose}
    >
          {known.map(([id, card]) => {
            const clickable = (targetSet.has(id) || playableSet.has(id)) && onCardClick
            return (
              <div
                key={id}
                className="pile-card-wrapper zone-fan-item is-revealed"
              >
                <CardSlot
                  cardId={id}
                  card={card}
                  className="pile-card"
                  isTarget={targetSet.has(id)}
                  isPlayable={playableSet.has(id)}
                  onClick={clickable ? () => onCardClick!(id) : undefined}
                />
              </div>
            )
          })}
          {Array.from({ length: unknownCount }, (_, i) => (
            <div key={`hv-back-${i}`} className="pile-card-wrapper zone-fan-item" data-testid="hand-viewer-back" data-index={known.length + i + 1}>
              <CardSlot card={{ id: `hv-back-${i}`, name: '?', manaValue: 0, expansionSetCode: '', cardNumber: '0' }} faceDown className="pile-card" />
            </div>
          ))}
          {known.length === 0 && unknownCount === 0 && (
            <EmptyState>{t('game', 'pile_hand')}</EmptyState>
          )}
    </ZoneViewer>
  )
}
