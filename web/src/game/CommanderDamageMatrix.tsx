import { useState, useMemo } from 'react'
import type { CardView, GameView, PlayerView } from '../net/types'
import { parseCommandList } from '../board/CommandZone'
import { useTranslation } from '../i18n'
import './CommanderDamageMatrix.css'

export const COMMANDER_LETHAL = 21
const MAX_POD_PLAYERS = 4

interface CommanderInfo {
  id: string
  name: string
  ownerId: string
  ownerName: string
  card: CardView
}

function extractDamage(target: PlayerView, commander: CommanderInfo, game?: GameView | null): number {
  const anyTarget = target as unknown as Record<string, unknown>
  const anyCard = commander.card as unknown as Record<string, unknown>

  const targetKeys = ['commanderDamage', 'commanderDamages', 'commanderDamageMap', 'damageByCommander', 'receivedCommanderDamage', 'commanderDamageMatrix', 'commander_damage']
  for (const key of targetKeys) {
    const val = anyTarget[key]
    if (val && typeof val === 'object') {
      const map = val as Record<string, unknown>
      if (typeof map[commander.id] === 'number') return map[commander.id] as number
      if (typeof map[String(commander.id)] === 'number') return map[String(commander.id)] as number
      if (typeof map[commander.name] === 'number') return map[commander.name] as number
      for (const [k, v] of Object.entries(map)) {
        if (k.includes(commander.id) && typeof v === 'number') return v as number
      }
    }
    if (typeof val === 'number' && key === 'commanderDamage') {
      return val as number
    }
  }

  const counters = (target.counters ?? []) as Array<{ name: string; count: number }>
  for (const c of counters) {
    const nl = String(c.name ?? '').toLowerCase()
    if (nl.includes('commander') && nl.includes(commander.name.toLowerCase())) {
      return c.count
    }
    if (nl === `commander-${commander.id}` || nl === `commander ${commander.name}`.toLowerCase()) {
      return c.count
    }
  }

  const cardKeys = ['damageToPlayer', 'damageMap', 'commanderDamage', 'dealtDamageMap', 'damageToPlayers']
  for (const key of cardKeys) {
    const val = anyCard[key]
    if (val && typeof val === 'object') {
      const map = val as Record<string, unknown>
      if (typeof map[target.playerId] === 'number') return map[target.playerId] as number
      if (typeof map[String(target.playerId)] === 'number') return map[String(target.playerId)] as number
      if (typeof map[target.name] === 'number') return map[target.name] as number
    }
  }

  const cardsToInspect: Array<Record<string, unknown>> = [anyCard]

  if (game?.players) {
    for (const p of game.players) {
      if (p.battlefield) {
        const perms = Array.isArray(p.battlefield) ? p.battlefield : Object.values(p.battlefield)
        for (const perm of perms as Array<Record<string, unknown>>) {
          if (perm.id === commander.id || perm.name === commander.name || perm.mainCardId === commander.id) {
            cardsToInspect.push(perm)
          }
        }
      }
      if (p.graveyard) {
        const graves = Array.isArray(p.graveyard) ? p.graveyard : Object.values(p.graveyard)
        for (const c of graves as Array<Record<string, unknown>>) {
          if (c.id === commander.id || c.name === commander.name) {
            cardsToInspect.push(c)
          }
        }
      }
    }
  }

  let maxDmgFromRules = 0
  for (const card of cardsToInspect) {
    const rules: string[] = Array.isArray(card['rules']) ? (card['rules'] as string[]) : []
    for (const raw of rules) {
      const sanitized = raw.replace(/<[^>]*>/g, ' ')
      let m = sanitized.match(/did\s+(\d+)\s+combat damage to player\s+([^.<]+)/i)
      if (!m) m = sanitized.match(/did\s+(\d+)\s+combat damage to\s+([^.<]+)/i)
      if (m) {
        const dmg = parseInt(m[1], 10)
        const damagedName = m[2].trim()
        if (damagedName === target.name || damagedName.toLowerCase() === target.name.toLowerCase()) {
          maxDmgFromRules = Math.max(maxDmgFromRules, dmg)
        }
      }
    }

    if (Array.isArray(card['cardIcons'])) {
      for (const icon of card['cardIcons'] as Array<Record<string, unknown>>) {
        const text = String(icon['hint'] ?? icon['text'] ?? '')
        const sanitized = text.replace(/<[^>]*>/g, ' ')
        let m = sanitized.match(/did\s+(\d+)\s+combat damage to player\s+([^.<]+)/i)
        if (!m) m = sanitized.match(/did\s+(\d+)\s+combat damage to\s+([^.<]+)/i)
        if (m) {
          const dmg = parseInt(m[1], 10)
          const damagedName = m[2].trim()
          if (damagedName === target.name || damagedName.toLowerCase() === target.name.toLowerCase()) {
            maxDmgFromRules = Math.max(maxDmgFromRules, dmg)
          }
        }
      }
    }
  }

  return maxDmgFromRules
}

export interface CommanderDamageMatrixProps {
  game: GameView | null
}

export default function CommanderDamageMatrix({ game }: CommanderDamageMatrixProps) {
  const { t } = useTranslation()
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const players = useMemo(() => (game?.players ?? []).slice(0, MAX_POD_PLAYERS), [game?.players])

  const commanders: CommanderInfo[] = useMemo(() => {
    const res: CommanderInfo[] = []
    players.forEach((p) => {
      const items = parseCommandList(p.commandList as unknown[], (p.helperCards ?? {}) as Record<string, CardView>)
      items
        .filter((i) => i.isCommander)
        .forEach((i) => {
          res.push({
            id: i.id,
            name: i.card.name,
            ownerId: p.playerId,
            ownerName: p.name,
            card: i.card,
          })
        })
    })
    return res.slice(0, 8)
  }, [players])

  const lethalAlerts = useMemo(() => {
    const alerts: Array<{ targetName: string; commanderName: string; ownerName: string; dmg: number; isLethal: boolean }> = []
    players.forEach((p) => {
      commanders.forEach((c) => {
        if (p.playerId !== c.ownerId) {
          const dmg = extractDamage(p, c, game)
          if (dmg >= 15) {
            alerts.push({
              targetName: p.name,
              commanderName: c.name,
              ownerName: c.ownerName,
              dmg,
              isLethal: dmg >= COMMANDER_LETHAL,
            })
          }
        }
      })
    })
    return alerts
  }, [players, commanders])

  if (players.length === 0) return null
  if (commanders.length === 0) {
    return (
      <div className="commander-damage-matrix is-empty" data-testid="commander-damage-matrix">
        <div className="cdm-header">
          <span className="cdm-title">👑 {t('game', 'commander_damage')}</span>
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
          <span className="cdm-title">👑 {t('game', 'commander_damage')}</span>
          <span className="cdm-lethal-hint">{t('game', 'commander_lethal_label', { count: String(COMMANDER_LETHAL) })}</span>
        </div>
        <div className="cdm-view-toggles">
          <button
            type="button"
            className={`cdm-toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
            onClick={() => setViewMode('cards')}
            title={t('game', 'commander_view_cards_hint')}
          >
            📊
          </button>
          <button
            type="button"
            className={`cdm-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
            onClick={() => setViewMode('table')}
            title={t('game', 'commander_view_table_hint')}
          >
            ⊞
          </button>
        </div>
      </div>

      {lethalAlerts.length > 0 && (
        <div className="cdm-alert-box">
          {lethalAlerts.map((a, i) => (
            <div key={i} className={`cdm-alert-pill ${a.isLethal ? 'lethal' : 'warning'}`}>
              <span className="cdm-alert-icon">{a.isLethal ? '💀' : '⚠️'}</span>
              <span className="cdm-alert-text">
                <strong>{a.targetName}</strong>: {a.dmg}/{COMMANDER_LETHAL} de <em>{a.commanderName}</em>
              </span>
            </div>
          ))}
        </div>
      )}

      {viewMode === 'cards' ? (
        <div className="cdm-cards-list" data-testid="cdm-cards-list">
          {players.map((p) => {
            const playerCommanders = commanders.filter((c) => c.ownerId === p.playerId)
            const opposingCommanders = commanders.filter((c) => c.ownerId !== p.playerId)
            const isActive = p.playerId === game?.activePlayerId
            const isDefeated = p.hasLeft || p.life <= 0

            return (
              <div
                key={p.playerId}
                className={`cdm-player-card ${isActive ? 'is-active' : ''} ${isDefeated ? 'is-defeated' : ''}`}
                data-testid={`cdm-card-${p.playerId}`}
              >
                <div className="cdm-player-card-header">
                  <div className="cdm-player-identity">
                    <span className="cdm-player-dot" aria-hidden>
                      {isActive ? '▶' : '●'}
                    </span>
                    <span className="cdm-player-title">{p.name}</span>
                    {p.controlled && <span className="cdm-badge-you">{t('game', 'you').toUpperCase()}</span>}
                  </div>
                  <div className="cdm-player-life-pill">
                    <span className="cdm-life-heart">❤️</span>
                    <span className="cdm-life-val">{p.life}</span>
                  </div>
                </div>

                {playerCommanders.length > 0 && (
                  <div className="cdm-player-commanders">
                    {playerCommanders.map((cmd) => {
                      const castCount = Number((cmd.card as any).castCount ?? 0)
                      return (
                        <span key={cmd.id} className="cdm-commander-badge" title={`Comandante de ${p.name}`}>
                          👑 {cmd.name}
                          {castCount > 0 && (
                            <span className="cdm-tax-badge" title={`Tax: +{${castCount * 2}}`}>
                              +{castCount * 2}
                            </span>
                          )}
                        </span>
                      )
                    })}
                  </div>
                )}

                <div className="cdm-damage-list">
                  {opposingCommanders.length === 0 ? (
                    <div className="cdm-no-opponents">{t('game', 'commander_no_rivals')}</div>
                  ) : (
                    opposingCommanders.map((c) => {
                      const dmg = extractDamage(p, c, game)
                      const isLethal = dmg >= COMMANDER_LETHAL
                      const isWarning = dmg >= 15 && !isLethal
                      const pct = Math.min(100, Math.round((dmg / COMMANDER_LETHAL) * 100))
                      const severity = isLethal ? 'lethal' : isWarning ? 'warning' : dmg >= 8 ? 'mid' : 'low'

                      return (
                        <div key={c.id} className={`cdm-damage-item ${severity}`} data-testid={`cdm-item-${p.playerId}-${c.id}`}>
                          <div className="cdm-damage-row">
                            <div className="cdm-damage-source" title={`Comandante: ${c.name} (${c.ownerName})`}>
                              <span className="cdm-source-name">{c.name}</span>
                              <span className="cdm-source-owner">de {c.ownerName}</span>
                            </div>
                            <div className="cdm-damage-metric">
                              {isLethal ? (
                                <span className="cdm-lethal-badge">💀 LETAL</span>
                              ) : (
                                <span className="cdm-count-text">
                                  <strong>{dmg}</strong> <span className="cdm-denom">/ 21</span>
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
                <th key={c.id} className="cdm-commander-head" title={`${c.name} — de ${c.ownerName}`}>
                  <span className="cdm-cmd-name">{c.name}</span>
                  <span className="cdm-cmd-owner">({c.ownerName})</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((p) => {
              const isActivePlayer = p.playerId === game?.activePlayerId
              return (
                <tr key={p.playerId} className={isActivePlayer ? 'cdm-active-row' : ''} data-testid={`cdm-row-${p.playerId}`}>
                  <td className="cdm-player-cell">
                    <span className="cdm-player-name">{p.name}</span>
                    {p.controlled && <span className="cdm-you-badge">{t('game', 'you').toUpperCase()}</span>}
                    {isActivePlayer && <span className="cdm-active-badge">● activo</span>}
                  </td>
                  {commanders.map((c) => {
                    const dmg = extractDamage(p, c, game)
                    const isLethal = dmg >= COMMANDER_LETHAL
                    const isWarning = dmg >= 15 && dmg < COMMANDER_LETHAL
                    const isSelf = p.playerId === c.ownerId
                    return (
                      <td
                        key={c.id}
                        className={`cdm-damage-cell ${isLethal ? 'is-lethal' : ''} ${isWarning ? 'is-warning' : ''} ${isSelf ? 'is-self' : ''}`}
                        data-testid={`cdm-cell-${p.playerId}-${c.id}`}
                        data-damage={dmg}
                        data-lethal={isLethal ? 'true' : undefined}
                        title={isSelf ? t('game', 'commander_self_hint') : `${t('game', 'commander_damage_dealt', { name: c.name, damage: String(dmg), target: p.name })}${isLethal ? ' — ' + t('game', 'lethal') + ' (21+)' : ''}`}
                      >
                        {isSelf ? '—' : dmg}
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
