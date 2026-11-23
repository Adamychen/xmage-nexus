import EmptyState from '../ui/EmptyState'
import CardSlot from './CardSlot'
import type { CrossZonePlayable } from './crossZone'
import ZoneViewer from './ZoneViewer'
import { useTranslation, plural } from '../i18n'

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
  command: 'zone_command',
} as const

export function crossZoneLabel(zone: string, t: ReturnType<typeof useTranslation>['t']): string {
  const [kind, detail] = zone.split(/:(.*)/s)
  if (kind === 'stack') return t('game', 'pile_stack')
  if (kind === 'companion') return t('game', 'companion_window_plain')
  const key = ZONE_KEYS[kind as keyof typeof ZONE_KEYS]
  if (!key) return zone
  const label = t('board', key)
  return detail ? `${label} · ${detail}` : label
}

export default function CrossZoneOverlay({ playables, onClose, onPlay }: CrossZoneOverlayProps) {
  const { t } = useTranslation()

  return (
    <ZoneViewer
      title={t('game', 'cross_zone_title')}
      count={`${playables.length} ${plural('dialogs', 'viewer_card', playables.length)}`}
      className="cross-zone-overlay"
      itemCount={playables.length}
      onClose={onClose}
    >
      {playables.map(({ id, card, zone }) => (
        <div
          key={id}
          className="cross-zone-entry zone-fan-item"
          data-card-id={id}
          data-card-name={card.name || card.displayName}
        >
          <span className="cross-zone-source" data-zone={zone}>{crossZoneLabel(zone, t)}</span>
          <CardSlot cardId={id} card={card} className="pile-card" onClick={() => onPlay(id)} onHover={undefined} />
        </div>
      ))}
      {playables.length === 0 && (
        <EmptyState>{t('game', 'stack_empty')}</EmptyState>
      )}
    </ZoneViewer>
  )
}
