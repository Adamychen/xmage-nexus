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

function withBold(template: string, values: Record<string, string>): ReactNode[] {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const key = /^\{(\w+)\}$/.exec(part)?.[1]
    return key && key in values ? <strong key={i}>{values[key]}</strong> : part
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
        <div className="sm-hint">{t('game', 'commander_no_commanders')}</div>
      </div>
    )
  }

  return (
    <div className="seat-matrix" data-testid="commander-damage-matrix">
      <div className="sm-hint">{t('game', 'commander_matrix_hint')}</div>
      <div className="sm-grid" data-testid="cdm-seat-grid" style={{ '--sm-cols': seats.length } as CSSProperties}>
        <div />
        {seats.map((seat) => (
          <div
            key={seat.ownerId}
            className="sm-head"
            data-testid={`cdm-seat-head-${seat.ownerId}`}
            style={{ color: colorOf(seat.ownerId) }}
            title={seat.commanders.map((c) => c.name).join(' · ')}
          >
            {seat.ownerName}
          </div>
        ))}
        {players.map((player) => (
          <Fragment key={player.playerId}>
            <div className={`sm-row-name ${isPlayerOut(player) ? 'is-out' : ''}`} data-testid={`cdm-seat-row-${player.playerId}`}>
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
                  className={`sm-cell tone-${dmg.tone}`}
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
        <div className="sm-hint" data-testid="cdm-threat">
          {withBold(t('game', 'commander_threat'), {
            owner: threat.owner,
            n: String(threat.remaining),
            victim: threat.victim,
            commander: threat.commander,
          })}
        </div>
      )}
    </div>
  )
}
