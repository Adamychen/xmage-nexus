import { useEffect, useCallback } from 'react'
import CardSlot from './CardSlot'
import type { CrossZonePlayable } from './crossZone'
import { useTranslation } from '../i18n'
import './PileOverlay.css'

interface CrossZoneOverlayProps {
  playables: CrossZonePlayable[]
  onClose: () => void
  onPlay: (id: string) => void
}

export default function CrossZoneOverlay({ playables, onClose, onPlay }: CrossZoneOverlayProps) {
  const { t } = useTranslation()
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
   }, [onClose])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
   }, [handleKeyDown])

  return (
    <div className="pile-overlay-backdrop" onClick={onClose}>
      <div className="pile-overlay cross-zone-overlay" onClick={(e) => e.stopPropagation()}>
        <div className="pile-overlay-header">
          <h3>{t('game', 'pile_stack')} ({playables.length})</h3>
          <button type="button" className="pile-overlay-close" onClick={onClose}>
          &times;
          </button>
        </div>
        <div className="pile-overlay-scroll">
          {playables.map(({ id, card, zone }) => (
             <div key={id} className="cross-zone-entry" data-card-id={id} data-card-name={card.name || card.displayName}>
               <CardSlot cardId={id} card={card} className="pile-card" onClick={() => onPlay(id)} onHover={undefined} />
               <span className="cross-zone-source">{zone}</span>
             </div>
           ))}
          {playables.length === 0 && (
            <div className="pile-overlay-empty">{t('game', 'stack_empty')}</div>
          )}
        </div>
      </div>
    </div>
  )
}
