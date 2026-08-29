import type { PlayerView } from '../net/types'
import './TurnOrderRing.css'

export interface TurnOrderRingProps {
  players: PlayerView[]
  activePlayerId: string
}

const MAX_POD_PLAYERS = 4

export default function TurnOrderRing({ players, activePlayerId }: TurnOrderRingProps) {
  const clamped = (players ?? []).slice(0, MAX_POD_PLAYERS)
  const count = clamped.length
  if (count === 0) return null

  return (
    <div
      className={`turn-order-ring count-${count}`}
      data-testid="turn-order-ring"
      role="navigation"
      aria-label="Turn order"
    >
      <div className="tor-track" />
      <div className="tor-seats-flow">
        {clamped.map((p, idx) => {
          const isActive = p.playerId === activePlayerId
          const isPriority = !!p.hasPriority
          const isDefeated = p.hasLeft === true || p.life <= 0
          const nextPlayer = clamped[(idx + 1) % count]
          const isActiveEdge = isActive

          return (
            <div key={p.playerId} className="tor-seat-group">
              <div
                className={`tor-seat ${isActive ? 'is-active' : ''} ${isPriority ? 'has-priority' : ''} ${isDefeated ? 'is-defeated' : ''} ${p.controlled ? 'is-controlled' : ''}`}
                data-testid={`tor-seat-${p.playerId}`}
                data-active={isActive ? 'true' : undefined}
                title={`${p.name}${isActive ? ' — turno activo' : ''}${isPriority ? ' (prioridad)' : ''} · Vida: ${p.life}`}
              >
                <span className="tor-seat-dot" aria-hidden>
                  {isActive ? '▶' : '●'}
                </span>
                <span className="tor-seat-name">{p.name}</span>
                <span className="tor-seat-life">{p.life <= 0 || p.hasLeft ? '💀' : p.life}</span>
                {isActive && <span className="tor-active-badge">Active</span>}
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
