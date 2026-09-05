import type { PlayerView } from '../net/types'
import { useTranslation } from '../i18n'
import { MAX_BOARD_PLAYERS } from './boardShared'
import Icon from '../ui/Icon'
import './TurnOrderRing.css'

export interface TurnOrderRingProps {
  players: PlayerView[]
  activePlayerId: string
}

export default function TurnOrderRing({ players, activePlayerId }: TurnOrderRingProps) {
  const { t } = useTranslation()
  const clamped = (players ?? []).slice(0, MAX_BOARD_PLAYERS)
  // El servidor lista a los jugadores en orden de mapa (table added order),
  // pero los turnos avanzan en orden inverso: PlayerList se construye con
  // CircularList.add(), que inserta en cabeza e invierte la lista. Se muestra
  // el orden real de turnos (inverso al recibido).
  const ordered = [...clamped].reverse()
  const count = ordered.length
  if (count === 0) return null

  return (
    <div
      className={`turn-order-ring count-${count}`}
      data-testid="turn-order-ring"
      role="navigation"
      aria-label={t('board', 'turn_order_label')}
    >
      <div className="tor-track" />
      <div className="tor-seats-flow">
        {ordered.map((p, idx) => {
          const isActive = p.playerId === activePlayerId
          const isPriority = !!p.hasPriority
          const isDefeated = p.hasLeft === true || p.life <= 0
          const nextPlayer = ordered[(idx + 1) % count]
          const isActiveEdge = isActive

          return (
            <div key={p.playerId} className="tor-seat-group">
              <div
                className={`tor-seat ${isActive ? 'is-active' : ''} ${isPriority ? 'has-priority' : ''} ${isDefeated ? 'is-defeated' : ''} ${p.controlled ? 'is-controlled' : ''}`}
                data-testid={`tor-seat-${p.playerId}`}
                data-active={isActive ? 'true' : undefined}
                title={`${p.name}${isActive ? t('board', 'turn_active_suffix') : ''}${isPriority ? t('board', 'turn_priority_suffix') : ''} · ${t('board', 'turn_life_label')}: ${p.life}`}
              >
                <span className="tor-seat-dot" aria-hidden>
                  {isActive ? <Icon name="play" size={9} /> : <Icon name="circle" size={7} />}
                </span>
                <span className="tor-seat-name">{p.name}</span>
                <span className="tor-seat-life">{p.life <= 0 || p.hasLeft ? <Icon name="skull" size={11} /> : p.life}</span>
                {isActive && <span className="tor-active-badge">{t('board', 'turn_active_badge')}</span>}
              </div>
              {count > 1 && (
                <span
                  className={`tor-arrow ${isActiveEdge ? 'is-active-edge' : ''}`}
                  data-testid={`tor-arrow-${p.playerId}-${nextPlayer.playerId}`}
                  aria-hidden
                >
                  →
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
