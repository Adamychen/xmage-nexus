import type { PlayerView } from '../net/types'
import { useTranslation } from '../i18n'
import { isPlayerOut, MAX_BOARD_PLAYERS } from './boardShared'
import Icon from '../ui/Icon'
import './TurnOrderRing.css'

export interface TurnOrderRingProps {
  players: PlayerView[]
  activePlayerId: string
  /**
   * The 1v1 walkway (`lane`) keeps the slots in board position — top player
   * first, my side last — instead of turning them around the table, so the
   * marker alternates sides in sync with the two halves of the board and the
   * read survives peripheral vision. Life is left out: both player bars
   * already show it, and the strip band is 36px tall.
   */
  lane?: boolean
}

export function turnOrderSeats(players: PlayerView[] | undefined, lane = false): PlayerView[] {
  const clamped = (players ?? []).slice(0, MAX_BOARD_PLAYERS)
  if (lane) return [...clamped.filter((p) => !p.controlled), ...clamped.filter((p) => p.controlled)]
  // The server lists players in map order (table added order) but turns advance
  // in reverse: PlayerList is built with CircularList.add(), which inserts at
  // the head and inverts the list. Show the real turn order (the reverse).
  return [...clamped].reverse()
}

export default function TurnOrderRing({ players, activePlayerId, lane = false }: TurnOrderRingProps) {
  const { t } = useTranslation()
  const ordered = turnOrderSeats(players, lane)
  const count = ordered.length
  if (count === 0) return null

  return (
    <div
      className={`turn-order-ring ${lane ? 'lane' : ''} count-${count}`}
      data-testid={lane ? 'turn-lane' : 'turn-order-ring'}
      data-active-player={activePlayerId || undefined}
      role="navigation"
      aria-label={t('board', 'turn_order_label')}
    >
      <div className="tor-track" />
      <div className="tor-seats-flow">
        {ordered.map((p, idx) => {
          const isActive = p.playerId === activePlayerId
          const isPriority = !!p.hasPriority
          const isDefeated = isPlayerOut(p)
          const nextPlayer = ordered[(idx + 1) % count]
          const isActiveEdge = isActive

          return (
            <div key={p.playerId} className="tor-seat-group">
              <div
                className={`tor-seat ${isActive ? 'is-active' : ''} ${isPriority ? 'has-priority' : ''} ${isDefeated ? 'is-defeated' : ''} ${p.controlled ? 'is-controlled' : ''}`}
                data-testid={`tor-seat-${p.playerId}`}
                data-active={isActive ? 'true' : undefined}
                data-priority={isPriority ? 'true' : undefined}
                title={`${p.name}${isActive ? t('board', 'turn_active_suffix') : ''}${isPriority ? t('board', 'turn_priority_suffix') : ''} · ${t('board', 'turn_life_label')}: ${p.life}`}
              >
                <span className="tor-seat-dot" aria-hidden>
                  {isActive ? <Icon name="play" size={9} /> : <Icon name="circle" size={7} />}
                </span>
                <span className="tor-seat-name">{p.name}</span>
                {!lane && <span className="tor-seat-life">{isDefeated ? <Icon name="skull" size={11} /> : p.life}</span>}
                {isActive && (
                  <span className="tor-active-badge" data-testid="tor-active-badge">
                    {p.controlled ? t('game', 'your_turn') : t('board', 'turn_active_badge')}
                  </span>
                )}
              </div>
              {/* In the walkway the chain stops at the last seat: a trailing
                  arrow would point at nobody (it is the ring wrapping around). */}
              {count > 1 && (!lane || idx < count - 1) && (
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
