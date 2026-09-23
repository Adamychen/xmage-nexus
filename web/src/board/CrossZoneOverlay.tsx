import { createPortal } from 'react-dom'
import CloseButton from '../ui/CloseButton'
import { useEscape } from '../ui/useEscape'
import EmptyState from '../ui/EmptyState'
import CardSlot from './CardSlot'
import type { CrossZonePlayable } from './crossZone'
import { useTranslation } from '../i18n'
import './PileOverlay.css'

interface CrossZoneOverlayProps {
  playables: CrossZonePlayable[]
  onClose: () => void
  onPlay: (id: string) => void
}

const ZONE_KEYS = {
  graveyard: 'pile_graveyard',
  exile: 'pile_exile',
  library: 'pile_library',
  battlefield: 'zone_battlefield',
  revealed: 'zone_revealed',
  sideboard: 'zone_sideboard',
} as const

export function crossZoneLabel(zone: string, t: ReturnType<typeof useTranslation>['t']): string {
  const [kind, detail] = zone.split(/:(.*)/s)
  if (kind === 'stack') return t('game', 'pile_stack')
  const key = ZONE_KEYS[kind as keyof typeof ZONE_KEYS]
  if (!key) return zone
  const label = t('board', key)
  return detail ? `${label} · ${detail}` : label
}

export default function CrossZoneOverlay({ playables, onClose, onPlay }: CrossZoneOverlayProps) {
  const { t } = useTranslation()
  useEscape(onClose)

  return createPortal(
    <div className="pile-overlay-backdrop" onClick={onClose} data-space-shortcut-off="true">
      <div className="pile-overlay cross-zone-overlay" onClick={(e) => e.stopPropagation()}>
        <div className="pile-overlay-header">
          <h3>{t('game', 'cross_zone_title')} ({playables.length})</h3>
          <CloseButton variant="solid" size="lg" className="pile-overlay-close" onClick={onClose} />
        </div>
        <div className="pile-overlay-scroll">
          {playables.map(({ id, card, zone }) => (
             <div key={id} className="cross-zone-entry" data-card-id={id} data-card-name={card.name || card.displayName}>
               <CardSlot cardId={id} card={card} className="pile-card" onClick={() => onPlay(id)} onHover={undefined} />
               <span className="cross-zone-source" data-zone={zone}>{crossZoneLabel(zone, t)}</span>
             </div>
           ))}
          {playables.length === 0 && (
            <EmptyState>{t('game', 'stack_empty')}</EmptyState>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
