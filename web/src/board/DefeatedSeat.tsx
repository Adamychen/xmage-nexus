import type { PlayerView } from '../net/types'
import Icon from '../ui/Icon'
import { useTranslation } from '../i18n'
import { useOutReason } from './boardShared'
import { OUT_ICON, OUT_STATUS } from './outReason'
import './DefeatedSeat.css'

interface DefeatedSeatProps {
  player: PlayerView
  open: boolean
  onToggle: () => void
}

export default function DefeatedSeat({ player, open, onToggle }: DefeatedSeatProps) {
  const { t } = useTranslation()
  // BRD-65: the strip gives the same three reasons the panel's head gives.
  const reason = useOutReason(player)
  const status = t('game', OUT_STATUS[reason])
  return (
    <button
      type="button"
      className={`defeated-seat${open ? ' is-open' : ''}${reason === 'died' ? '' : ' is-left'}`}
      data-testid="defeated-seat"
      data-seat-id={player.playerId}
      data-out={reason}
      data-player-id={open ? undefined : player.playerId}
      data-player-name={open ? undefined : player.name}
      aria-expanded={open}
      aria-label={`${player.name} ${status}`}
      title={t('board', 'opp_view', { name: player.name })}
      onClick={onToggle}
    >
      <span className="defeated-seat-icon"><Icon name={OUT_ICON[reason]} size={16} /></span>
      <span className="defeated-seat-name">{player.name}</span>
      <span className="defeated-seat-status">{status}</span>
      <span className="defeated-seat-chevron" aria-hidden="true"><Icon name={open ? 'chevronUp' : 'chevronDown'} size={12} /></span>
    </button>
  )
}
