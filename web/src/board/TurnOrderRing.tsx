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

  const activeIndex = clamped.findIndex((p) => p.playerId === activePlayerId)

  return (
    <div
      className={`turn-order-ring count-${count}`}
      data-testid="turn-order-ring"
      role="navigation"
      aria-label="Turn order"
    >
      <div className="tor-track" />
      {clamped.map((p, idx) => {
        const isActive = p.playerId === activePlayerId
        const isPriority = !!p.hasPriority
        const isDefeated = p.hasLeft === true || p.life <= 0
        const angle = count === 1 ? -90 : (idx * 360) / count - 90
        const style: React.CSSProperties | undefined =
          count >= 3
            ? {
                transform: `translate(-50%, -50%) rotate(${angle}deg) translate(var(--tor-radius)) rotate(${-angle}deg)`,
              } as React.CSSProperties
            : undefined

        return (
          <div
            key={p.playerId}
            className={`tor-seat ${isActive ? 'is-active' : ''} ${isPriority ? 'has-priority' : ''} ${isDefeated ? 'is-defeated' : ''} ${p.controlled ? 'is-controlled' : ''}`}
            data-testid={`tor-seat-${p.playerId}`}
            data-active={isActive ? 'true' : undefined}
            title={`${p.name}${isActive ? ' — turno activo' : ''}${isPriority ? ' (prioridad)' : ''}`}
            style={style}
          >
            <span className="tor-seat-dot" aria-hidden>
              {isActive ? '▶' : '●'}
            </span>
            <span className="tor-seat-name">{p.name}</span>
            {isActive && <span className="tor-active-badge">Active</span>}
            {p.life <= 0 || p.hasLeft ? <span className="tor-defeated">💀</span> : null}
          </div>
        )
      })}
      {count >= 2 && activeIndex >= 0 && (
        <div className="tor-progression" aria-hidden>
          {clamped.map((_, i) => {
            const from = clamped[i]
            const to = clamped[(i + 1) % count]
            const isActiveEdge = from.playerId === activePlayerId
            return (
              <span
                key={`${from.playerId}->${to.playerId}`}
                className={`tor-arrow ${isActiveEdge ? 'is-active-edge' : ''}`}
                data-testid={`tor-arrow-${from.playerId}-${to.playerId}`}
              >
                →
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
