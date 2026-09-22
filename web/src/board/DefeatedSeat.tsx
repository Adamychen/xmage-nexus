import type { PlayerView } from '../net/types'
import Icon from '../ui/Icon'
import { useTranslation } from '../i18n'
import './DefeatedSeat.css'

interface DefeatedSeatProps {
  player: PlayerView
  open: boolean
  onToggle: () => void
}

export default function DefeatedSeat({ player, open, onToggle }: DefeatedSeatProps) {
  const { t } = useTranslation()
  const left = player.hasLeft === true
  const status = t('game', left ? 'player_left' : 'player_defeated')
  return (
    <button
      type="button"
      className={`defeated-seat${open ? ' is-open' : ''}${left ? ' is-left' : ''}`}
      data-testid="defeated-seat"
      data-seat-id={player.playerId}
      data-player-id={open ? undefined : player.playerId}
      data-player-name={open ? undefined : player.name}
      aria-expanded={open}
      aria-label={`${player.name} ${status}`}
      title={t('board', 'opp_view', { name: player.name })}
      onClick={onToggle}
    >
      <span className="defeated-seat-icon"><Icon name={left ? 'door' : 'skull'} size={16} /></span>
      <span className="defeated-seat-name">{player.name}</span>
      <span className="defeated-seat-status">{status}</span>
      <span className="defeated-seat-chevron" aria-hidden="true"><Icon name={open ? 'chevronUp' : 'chevronDown'} size={12} /></span>
    </button>
  )
}
