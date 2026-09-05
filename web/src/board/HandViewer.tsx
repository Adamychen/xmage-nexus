import { useEffect, useCallback, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CardView } from '../net/types'
import CardSlot from './CardSlot'
import FloatingCardPreview from './FloatingCardPreview'
import { useTranslation } from '../i18n'
import './PileOverlay.css'

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

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const handleCardHover = (card: any, rect?: DOMRect) => {
    setHoverCard(card ?? null)
    setHoverRect(rect ?? null)
  }

  const total = known.length + unknownCount

  return createPortal(
    <div className="pile-overlay-backdrop" onClick={onClose}>
      <div className="pile-overlay hand-viewer" data-testid="hand-viewer" onClick={(e) => e.stopPropagation()}>
        <div className="pile-overlay-header">
          <div className="pile-header-titles">
            <h3>{t('game', 'opp_hand_view', { known: known.length, count: total }) + ` — ${playerName}`}</h3>
          </div>
          <button type="button" className="pile-overlay-close" onClick={onClose} title={`${t('common', 'close')} (Esc)`}>
            &times;
          </button>
        </div>
        <div className="pile-overlay-scroll">
          {known.map(([id, card], index) => {
            const clickable = (targetSet.has(id) || playableSet.has(id)) && onCardClick
            return (
              <div key={id} className="pile-card-wrapper is-revealed">
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
            <div key={`hv-back-${i}`} className="pile-card-wrapper" data-testid="hand-viewer-back" data-index={known.length + i + 1}>
              <div className="pile-position-badge">#{known.length + i + 1}</div>
              <CardSlot card={{ id: `hv-back-${i}`, name: '?', manaValue: 0, expansionSetCode: '', cardNumber: '0' }} faceDown className="pile-card" />
            </div>
          ))}
          {known.length === 0 && unknownCount === 0 && (
            <div className="pile-overlay-empty">{t('game', 'pile_hand')}</div>
          )}
        </div>
      </div>

      <FloatingCardPreview
        card={hoverCard}
        anchorRect={hoverRect}
        fixedSide="left"
        inModal
      />
    </div>,
    document.body
  )
}
