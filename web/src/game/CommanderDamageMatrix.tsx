import { useState, useMemo } from 'react'
import Tabs from '../ui/Tabs'
import Chip from '../ui/Chip'
import type { GameView, PlayerView } from '../net/types'
import { commanderDamageDealt, commanderTax, syncCommanderMemory, type MatrixCommander } from '../board/commanders'
import { isPlayerOut } from '../board/boardShared'
import Icon from '../ui/Icon'
import { useTranslation } from '../i18n'
import './CommanderDamageMatrix.css'

export const COMMANDER_LETHAL = 21

/** Start flagging before lethal so a player can react (UI choice, not a rule). */
export const COMMANDER_WARNING = 15

interface DamageCell {
  commander: MatrixCommander
  dmg: number
  isSelf: boolean
}

interface DamageRow {
  player: PlayerView
  cells: DamageCell[]
}

/** Commanders shown as columns, each player as a row: one column per commander object, so
 *  two players running the same card get one column each (they deal separate damage). No
 *  board clamp here — the 2x2 layout paints 4 seats, the table must still list everyone.
 *  El roster viene con memoria de partida (`syncCommanderMemory`): un comandante en zona
 *  invisible (mano/biblioteca) mantiene su columna y sus totales de la última vista. */
function useDamageMatrix(game: GameView | null) {
  return useMemo(() => {
    const players = game?.players ?? []
    const commanders = syncCommanderMemory(game).filter((c) => !c.isCompanion || c.isCommander)
    const rows: DamageRow[] = players.map((p) => ({
      player: p,
      cells: commanders.map((c) => ({
        commander: c,
        dmg: commanderDamageDealt(game, c, p),
        isSelf: p.playerId === c.ownerId,
      })),
    }))
    return { players, commanders, rows }
  }, [game])
}

export interface CommanderDamageMatrixProps {
  game: GameView | null
}

export default function CommanderDamageMatrix({ game }: CommanderDamageMatrixProps) {
  const { t } = useTranslation()
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const { players, commanders, rows } = useDamageMatrix(game)

  const alerts = useMemo(
    () =>
      rows
        .flatMap((row) => row.cells.map((cell) => ({ row, cell })))
        .filter(({ cell }) => !cell.isSelf && cell.dmg >= COMMANDER_WARNING)
        .map(({ row, cell }) => ({
          targetName: row.player.name,
          commanderName: cell.commander.name,
          ownerName: cell.commander.ownerName,
          dmg: cell.dmg,
          isLethal: cell.dmg >= COMMANDER_LETHAL,
        })),
    [rows],
  )

  if (players.length === 0) return null
  if (commanders.length === 0) {
    return (
      <div className="commander-damage-matrix is-empty" data-testid="commander-damage-matrix">
        <div className="cdm-header">
          <span className="cdm-title"><Icon name="crown" size={13} /> {t('game', 'commander_damage')}</span>
          <span className="cdm-lethal-hint">{t('game', 'commander_lethal_label', { count: String(COMMANDER_LETHAL) })}</span>
        </div>
        <div className="cdm-empty">{t('game', 'commander_no_commanders')}</div>
      </div>
    )
  }

  return (
    <div className={`commander-damage-matrix view-${viewMode}`} data-testid="commander-damage-matrix">
      <div className="cdm-header">
        <div className="cdm-header-left">
          <span className="cdm-title"><Icon name="crown" size={13} /> {t('game', 'commander_damage')}</span>
          <span className="cdm-lethal-hint">{t('game', 'commander_lethal_label', { count: String(COMMANDER_LETHAL) })}</span>
        </div>
        <Tabs
          variant="segmented"
          size="sm"
          value={viewMode}
          onChange={setViewMode}
          items={[
            { id: 'cards', icon: 'chart', title: t('game', 'commander_view_cards_hint') },
            { id: 'table', icon: 'grid', title: t('game', 'commander_view_table_hint') },
          ]}
        />
      </div>

      {alerts.length > 0 && (
        <div className="cdm-alert-box">
          {alerts.map((a, i) => (
            <div key={i} className={`cdm-alert-pill ${a.isLethal ? 'lethal' : 'warning'}`}>
              <span className="cdm-alert-icon"><Icon name={a.isLethal ? 'skull' : 'alert'} size={13} /></span>
              <span className="cdm-alert-text">
                <strong>{a.targetName}</strong>: {a.dmg}/{COMMANDER_LETHAL} <em>{t('game', 'commander_of', { owner: a.commanderName })}</em>
              </span>
            </div>
          ))}
        </div>
      )}

      {viewMode === 'cards' ? (
        <div className="cdm-cards-list" data-testid="cdm-cards-list">
          {rows.map((row) => {
            const p = row.player
            const isActive = p.playerId === game?.activePlayerId
            const isDefeated = isPlayerOut(p)
            const own = row.cells.filter((c) => c.isSelf)
            const rivals = row.cells.filter((c) => !c.isSelf)

            return (
              <div
                key={p.playerId}
                className={`cdm-player-card ${isActive ? 'is-active' : ''} ${isDefeated ? 'is-defeated' : ''}`}
                data-testid={`cdm-card-${p.playerId}`}
              >
                <div className="cdm-player-card-header">
                  <div className="cdm-player-identity">
                    <span className="cdm-player-dot" aria-hidden>
                      {isActive ? <Icon name="play" size={10} /> : <Icon name="circle" size={8} />}
                    </span>
                    <span className="cdm-player-title">{p.name}</span>
                    {p.controlled && <Chip solid tone="ok" size="xs">{t('game', 'you')}</Chip>}
                  </div>
                  <div className="cdm-player-life-pill">
                    <span className="cdm-life-heart"><Icon name="heart" size={12} /></span>
                    <span className="cdm-life-val">{p.life}</span>
                  </div>
                </div>

                {own.length > 0 && (
                  <div className="cdm-player-commanders">
                    {own.map((c) => (
                      <Chip key={c.commander.id} tone="gold" size="xs" icon="crown" title={t('game', 'commander_source_label', { name: p.name })}>
                        {c.commander.name}
                        {c.commander.castCount > 0 && (
                          <Chip tone="err" size="xs" title={t('board', 'commander_tax', { tax: commanderTax(c.commander.castCount), count: c.commander.castCount })}>
                            +{commanderTax(c.commander.castCount)}
                          </Chip>
                        )}
                      </Chip>
                    ))}
                  </div>
                )}

                <div className="cdm-damage-list">
                  {rivals.length === 0 ? (
                    <div className="cdm-no-opponents">{t('game', 'commander_no_rivals')}</div>
                  ) : (
                    rivals.map((cell) => {
                      const dmg = cell.dmg
                      const isLethal = dmg >= COMMANDER_LETHAL
                      const isWarning = dmg >= COMMANDER_WARNING && !isLethal
                      const pct = Math.min(100, Math.round((dmg / COMMANDER_LETHAL) * 100))
                      const severity = isLethal ? 'lethal' : isWarning ? 'warning' : dmg >= 8 ? 'mid' : 'low'

                      return (
                        <div key={cell.commander.id} className={`cdm-damage-item ${severity}`} data-testid={`cdm-item-${p.playerId}-${cell.commander.id}`}>
                          <div className="cdm-damage-row">
                            <div className="cdm-damage-source" title={t('game', 'commander_owner_label', { name: cell.commander.name, owner: cell.commander.ownerName })}>
                              <span className="cdm-source-name">{cell.commander.name}</span>
                              <span className="cdm-source-owner">{t('game', 'commander_of', { owner: cell.commander.ownerName })}</span>
                            </div>
                            <div className="cdm-damage-metric">
                              {isLethal ? (
                                <Chip tone="err" size="xs" icon="skull">{t('game', 'commander_lethal_short')}</Chip>
                              ) : (
                                <span className="cdm-count-text">
                                  <strong>{dmg}</strong> <span className="cdm-denom">/ {COMMANDER_LETHAL}</span>
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="cdm-progress-track">
                            <div
                              className={`cdm-progress-bar ${severity}`}
                              style={{ width: `${Math.max(dmg > 0 ? 6 : 0, pct)}%` }}
                            />
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : null}

      <div className={`cdm-table-wrap ${viewMode !== 'table' ? 'cdm-table-hidden' : ''}`}>
        <table className="cdm-table" data-testid="cdm-table">
          <thead>
            <tr>
              <th className="cdm-corner">{t('game', 'commander_table_corner')}</th>
              {commanders.map((c) => (
                <th key={c.id} className="cdm-commander-head" title={t('game', 'commander_owner_label', { name: c.name, owner: c.ownerName })}>
                  <span className="cdm-cmd-name">{c.name}</span>
                  <span className="cdm-cmd-owner">({c.ownerName})</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const p = row.player
              const isActivePlayer = p.playerId === game?.activePlayerId
              return (
                <tr key={p.playerId} className={isActivePlayer ? 'cdm-active-row' : ''} data-testid={`cdm-row-${p.playerId}`}>
                  <td className="cdm-player-cell">
                    <span className="cdm-player-name">{p.name}</span>
                    {p.controlled && <span className="cdm-you-badge">{t('game', 'you').toUpperCase()}</span>}
                    {isActivePlayer && <span className="cdm-active-badge">{t('game', 'commander_active')}</span>}
                  </td>
                  {row.cells.map((cell) => {
                    const isLethal = cell.dmg >= COMMANDER_LETHAL
                    const isWarning = cell.dmg >= COMMANDER_WARNING && !isLethal
                    return (
                      <td
                        key={cell.commander.id}
                        className={`cdm-damage-cell ${isLethal ? 'is-lethal' : ''} ${isWarning ? 'is-warning' : ''} ${cell.isSelf ? 'is-self' : ''}`}
                        data-testid={`cdm-cell-${p.playerId}-${cell.commander.id}`}
                        data-damage={cell.dmg}
                        data-lethal={isLethal ? 'true' : undefined}
                        title={cell.isSelf ? t('game', 'commander_self_hint') : `${t('game', 'commander_damage_dealt', { name: cell.commander.name, damage: String(cell.dmg), target: p.name })}${isLethal ? ' — ' + t('game', 'lethal') + ` (${COMMANDER_LETHAL}+)` : ''}`}
                      >
                        {cell.isSelf ? '—' : cell.dmg}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="cdm-footer">
        <span className="cdm-footer-hint">{t('game', 'commander_damage_hint')}</span>
      </div>
    </div>
  )
}