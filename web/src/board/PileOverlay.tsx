import { useEffect, useCallback, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CardView } from '../net/types'
import CardSlot from './CardSlot'
import Icon from '../ui/Icon'
import FloatingCardPreview from './FloatingCardPreview'
import { useTranslation } from '../i18n'
import './PileOverlay.css'

interface PileOverlayProps {
  title: string
  cards: Record<string, CardView>
  onClose: () => void
  playableIds?: Set<string>
  onPlayCard?: (id: string) => void
  isLibrary?: boolean
}

export default function PileOverlay({
  title,
  cards,
  onClose,
  playableIds,
  onPlayCard,
  isLibrary = false,
}: PileOverlayProps) {
  const { t } = useTranslation()
  const entries = Object.entries(cards)
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
    if (card?.faceDown) {
      setHoverCard(null)
      setHoverRect(null)
      return
    }
    setHoverCard(card ?? null)
    setHoverRect(rect ?? null)
  }

  const knownCount = entries.filter(([, c]) => !c.faceDown).length

  return createPortal(
    <div className="pile-overlay-backdrop" onClick={onClose}>
      <div className={`pile-overlay ${isLibrary ? 'library-overlay' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="pile-overlay-header">
          <div className="pile-header-titles">
            <h3>{title} ({entries.length} {t('dialogs', 'viewer_card_plural')})</h3>
            {isLibrary && (
              <span className="pile-header-subtitle">
                {knownCount > 0
                  ? (<><Icon name="eye" size={11} /> {knownCount} {t('board', 'zone_revealed').toLowerCase()} · #1 {t('board', 'zone_library')}</>)
                  : `${t('board', 'zone_library')}: #1 ${t('board', 'pile_top')}`}
              </span>
            )}
          </div>
          <button type="button" className="pile-overlay-close" onClick={onClose} title={`${t('common', 'close')} (Esc)`}>
            &times;
          </button>
        </div>
        <div className="pile-overlay-scroll">
          {entries.map(([id, card], index) => {
            const isTop = isLibrary && index === 0
            const isRevealed = !card.faceDown

            return (
              <div key={id} className={`pile-card-wrapper ${isTop ? 'is-top-card' : ''} ${isRevealed ? 'is-revealed' : ''}`}>
                {isLibrary && (
                  <div className={`pile-position-badge ${isTop ? 'top-badge' : ''} ${isRevealed ? 'revealed-badge' : ''}`}>
                    {isTop ? (<><Icon name="star" size={10} /> #1 {t('board', 'pile_top')}</>) : `#${index + 1}`}
                    {isRevealed && <span className="revealed-icon"><Icon name="eye" size={10} /></span>}
                  </div>
                )}
                <CardSlot
                  cardId={id}
                  card={card}
                  faceDown={card.faceDown === true}
                  className="pile-card"
                  isPlayable={playableSet.has(id)}
                  onClick={playableSet.has(id) && onPlayCard ? () => onPlayCard(id) : undefined}
                  onHover={handleCardHover}
                />
              </div>
            )
          })}
          {entries.length === 0 && (
            <div className="pile-overlay-empty">{isLibrary ? t('board', 'pile_library') : t('common', 'search')}</div>
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
