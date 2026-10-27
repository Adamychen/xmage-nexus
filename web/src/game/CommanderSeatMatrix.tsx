import { Fragment, useMemo, type CSSProperties, type ReactNode } from 'react'
import type { GameView } from '../net/types'
import { useTranslation } from '../i18n'
import { seatColorVar, seatIndexOf } from '../board/seatColor'
import { isPlayerOut } from '../board/boardShared'
import {
  COMMANDER_LETHAL_DAMAGE,
  biggestCommanderThreat,
  commanderSeats,
  formatSeatDamage,
  seatDamage,
} from './commanderSeats'
import './CommanderSeatMatrix.css'

function withParts(template: string, values: Record<string, ReactNode>): ReactNode[] {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const key = /^\{(\w+)\}$/.exec(part)?.[1]
    return key && key in values ? <Fragment key={i}>{values[key]}</Fragment> : part
  })
}

export default function CommanderSeatMatrix({ game }: { game: GameView | null }) {
  const { t } = useTranslation()
  const players = game?.players ?? []
  const seats = useMemo(() => commanderSeats(game), [game])
  const threat = useMemo(() => biggestCommanderThreat(game), [game])
  const colorOf = (id: string) => seatColorVar(seatIndexOf(players, id))

  if (players.length === 0) return null
  if (seats.length === 0) {
    return (
      <div className="seat-matrix is-empty" data-testid="commander-damage-matrix">
        <div className="sm-help">{t('game', 'commander_no_commanders')}</div>
      </div>
    )
  }

  return (
    <div className="seat-matrix" data-testid="commander-damage-matrix">
      <div className="sm-help" title={t('game', 'commander_matrix_hint')}>
        {t('game', 'commander_matrix_hint')}
      </div>
      <div className="sm-grid" data-testid="cdm-seat-grid" style={{ '--sm-cols': seats.length } as CSSProperties}>
        <div />
        {seats.map((seat) => {
          const commanderNames = seat.commanders.map((c) => c.name).join(' / ')
          return (
            <div
              key={seat.ownerId}
              className="sm-head"
              data-testid={`cdm-seat-head-${seat.ownerId}`}
              style={{ color: colorOf(seat.ownerId) }}
              title={seat.commanders.map((c) => c.name).join(' · ')}
            >
              <span className="sm-head-owner">{seat.ownerName}</span>
              <span className="sm-head-cmd" data-testid={`cdm-seat-commander-${seat.ownerId}`}>
                {commanderNames}
              </span>
            </div>
          )
        })}
        {players.map((player) => (
          <Fragment key={player.playerId}>
            <div
              className={`sm-row-name ${isPlayerOut(player) ? 'is-out' : ''}`}
              style={{ color: colorOf(player.playerId) }}
              data-testid={`cdm-seat-row-${player.playerId}`}
            >
              <span className="sm-dot" style={{ background: colorOf(player.playerId) }} aria-hidden="true" />
              {player.name}
            </div>
            {seats.map((seat) => {
              if (seat.ownerId === player.playerId) {
                return (
                  <div
                    key={seat.ownerId}
                    className="sm-cell is-self"
                    title={t('game', 'commander_self_hint')}
                    data-testid={`cdm-seat-cell-${player.playerId}-${seat.ownerId}`}
                  >
                    —
                  </div>
                )
              }
              const dmg = seatDamage(game, seat, player)
              return (
                <div
                  key={seat.ownerId}
                  className={`sm-cell tone-${dmg.tone}${dmg.max === 0 ? ' is-zero' : ''}`}
                  data-testid={`cdm-seat-cell-${player.playerId}-${seat.ownerId}`}
                  data-damage={formatSeatDamage(dmg.dmgs)}
                  title={seat.commanders
                    .map((c, i) => t('game', 'commander_damage_dealt', { name: c.name, damage: String(dmg.dmgs[i]), target: player.name }))
                    .join(' · ')}
                >
                  {formatSeatDamage(dmg.dmgs)}
                  <i
                    style={{
                      width: `${Math.min(100, (dmg.max / COMMANDER_LETHAL_DAMAGE) * 100)}%`,
                      background: colorOf(seat.ownerId),
                    }}
                  />
                </div>
              )
            })}
          </Fragment>
        ))}
      </div>
      {threat && (
        <div className="sm-threat" data-testid="cdm-threat">
          <div className="sm-threat-text">
            {withParts(t('game', 'commander_threat'), {
              owner: <strong style={{ color: colorOf(threat.ownerId) }}>{threat.owner}</strong>,
              n: <strong>{String(threat.remaining)}</strong>,
              victim: <strong style={{ color: colorOf(threat.victimId) }}>{threat.victim}</strong>,
              commander: <strong className="sm-threat-cmd">{threat.commander}</strong>,
            })}
          </div>
          <div className="sm-threat-meter">
            <div className="sm-threat-track">
              <i
                data-testid="cdm-threat-bar"
                style={{
                  width: `${(threat.damage / COMMANDER_LETHAL_DAMAGE) * 100}%`,
                  background: colorOf(threat.ownerId),
                }}
              />
            </div>
            <span className="sm-threat-num" data-testid="cdm-threat-num">
              <strong>{threat.damage}</strong> / {COMMANDER_LETHAL_DAMAGE}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
