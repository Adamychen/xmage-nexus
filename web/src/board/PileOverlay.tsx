import CloseButton from '../ui/CloseButton'
import { useEscape } from '../ui/useEscape'
import EmptyState from '../ui/EmptyState'
import { useMemo, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { CardView } from '../net/types'
import CardSlot from './CardSlot'
import Icon from '../ui/Icon'
import { PromptCardZoomable, usePromptCardPreview } from '../game/promptCardPreview'
import { overlayRoot } from './overlayRoot'
import { useTranslation, plural } from '../i18n'
import './PileOverlay.css'

interface PileOverlayProps {
  title: string
  cards: Record<string, CardView>
  onClose: () => void
  playableIds?: Set<string>
  onPlayCard?: (id: string) => void
  targetIds?: Set<string>
  onTargetClick?: (id: string) => void
  isLibrary?: boolean
  /** Revealed / looked-at cards turn face up one after another when the viewer opens. */
  flipIn?: boolean
}

export default function PileOverlay({
  title,
  cards,
  onClose,
  playableIds,
  onPlayCard,
  targetIds,
  onTargetClick,
  isLibrary = false,
  flipIn = false,
}: PileOverlayProps) {
  const { t } = useTranslation()
  const entries = Object.entries(cards)
  const playableSet = useMemo(() => playableIds ?? new Set<string>(), [playableIds])
  const targetSet = useMemo(() => targetIds ?? new Set<string>(), [targetIds])
  const cardPreview = usePromptCardPreview({ fixedSide: 'left' })

  useEscape(onClose)

  const knownCount = entries.filter(([, c]) => !c.faceDown).length

  return createPortal(
    <div className="pile-overlay-backdrop" onClick={onClose} data-space-shortcut-off="true">
      <div className={`pile-overlay ${isLibrary ? 'library-overlay' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="pile-overlay-header">
          <div className="pile-header-titles">
            <h3>{title} ({entries.length} {plural('dialogs', 'viewer_card', entries.length)})</h3>
            {isLibrary && (
              <span className="pile-header-subtitle">
                {knownCount > 0
                  ? (<><Icon name="eye" size={11} /> {knownCount} {t('board', 'zone_revealed').toLowerCase()} · #1 {t('board', 'zone_library')}</>)
                  : `${t('board', 'zone_library')}: #1 ${t('board', 'pile_top')}`}
              </span>
            )}
          </div>
          <CloseButton variant="solid" size="lg" className="pile-overlay-close" onClick={onClose} title={`${t('common', 'close')} (Esc)`} />
        </div>
        <div className="pile-overlay-scroll">
          {entries.map(([id, card], index) => {
            const isTop = isLibrary && index === 0
            const isRevealed = !card.faceDown
            const isPlayableCard = playableSet.has(id)
            const isTargetCard = targetSet.has(id)
            const cardOnClick = isPlayableCard && onPlayCard
              ? () => onPlayCard(id)
              : isTargetCard && onTargetClick
                ? () => onTargetClick(id)
                : undefined

            return (
              <div
                key={id}
                className={`pile-card-wrapper ${isTop ? 'is-top-card' : ''} ${isRevealed ? 'is-revealed' : ''}${flipIn ? ' is-flip-in' : ''}`}
                style={flipIn ? ({ '--flip-i': Math.min(index, 12) } as CSSProperties) : undefined}
              >
                {isLibrary && (
                  <div className={`pile-position-badge ${isTop ? 'top-badge' : ''} ${isRevealed ? 'revealed-badge' : ''}`}>
                    {isTop ? (<><Icon name="star" size={10} /> #1 {t('board', 'pile_top')}</>) : `#${index + 1}`}
                    {isRevealed && <span className="revealed-icon"><Icon name="eye" size={10} /></span>}
                  </div>
                )}
                <PromptCardZoomable preview={cardPreview} previewKey={id} card={card}>
                  <CardSlot
                    cardId={id}
                    card={card}
                    faceDown={card.faceDown === true}
                    className="pile-card"
                    isPlayable={isPlayableCard}
                    isTarget={isTargetCard}
                    onClick={cardOnClick}
                  />
                </PromptCardZoomable>
              </div>
            )
          })}
          {entries.length === 0 && (
            <EmptyState>{isLibrary ? t('board', 'pile_library') : t('common', 'search')}</EmptyState>
          )}
        </div>
      </div>

      {cardPreview.preview}
    </div>,
    overlayRoot()
  )
}
