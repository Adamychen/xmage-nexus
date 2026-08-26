import { useMemo } from 'react'
import type { CardView, GameView, PlayerView } from '../net/types'
import { parseCommandList } from '../board/CommandZone'
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

function extractDamage(target: PlayerView, commander: CommanderInfo): number {
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

  const rules: string[] = Array.isArray(anyCard['rules']) ? (anyCard['rules'] as string[]) : []
  for (const raw of rules) {
    const sanitized = raw.replace(/<[^>]*>/g, ' ')
    let m = sanitized.match(/did\s+(\d+)\s+combat damage to player\s+([^.<]+)/i)
    if (!m) m = sanitized.match(/did\s+(\d+)\s+combat damage to\s+([^.<]+)/i)
    if (m) {
      const dmg = parseInt(m[1], 10)
      const damagedName = m[2].trim()
      if (damagedName === target.name) return dmg
      if (damagedName.toLowerCase() === target.name.toLowerCase()) return dmg
    }
  }

  if (Array.isArray(anyCard['cardIcons'])) {
    for (const icon of anyCard['cardIcons'] as Array<Record<string, unknown>>) {
      const text = String(icon['hint'] ?? icon['text'] ?? '')
      const sanitized = text.replace(/<[^>]*>/g, ' ')
      let m = sanitized.match(/did\s+(\d+)\s+combat damage to player\s+([^.<]+)/i)
      if (!m) m = sanitized.match(/did\s+(\d+)\s+combat damage to\s+([^.<]+)/i)
      if (m) {
        const dmg = parseInt(m[1], 10)
        const damagedName = m[2].trim()
        if (damagedName === target.name || damagedName.toLowerCase() === target.name.toLowerCase()) return dmg
      }
    }
  }

  return 0
}

export interface CommanderDamageMatrixProps {
  game: GameView | null
}

export default function CommanderDamageMatrix({ game }: CommanderDamageMatrixProps) {
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

  if (players.length === 0) return null
  if (commanders.length === 0) {
    return (
      <div className="commander-damage-matrix is-empty" data-testid="commander-damage-matrix">
        <div className="cdm-header">
          <span className="cdm-title">Commander Damage</span>
          <span className="cdm-lethal-hint">21 lethal</span>
        </div>
        <div className="cdm-empty">No commanders — damage matrix is empty.</div>
      </div>
    )
  }

  return (
    <div className="commander-damage-matrix" data-testid="commander-damage-matrix">
      <div className="cdm-header">
        <span className="cdm-title">Commander Damage</span>
        <span className="cdm-lethal-hint">{COMMANDER_LETHAL} lethal</span>
      </div>
      <div className="cdm-table-wrap">
        <table className="cdm-table" data-testid="cdm-table">
          <thead>
            <tr>
              <th className="cdm-corner">Target \ Commander</th>
              {commanders.map((c) => (
                <th key={c.id} className="cdm-commander-head" title={`${c.name} — owned by ${c.ownerName}`}>
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
                    {p.controlled && <span className="cdm-you-badge">YOU</span>}
                    {isActivePlayer && <span className="cdm-active-badge">● active</span>}
                  </td>
                  {commanders.map((c) => {
                    const dmg = extractDamage(p, c)
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
                        title={isSelf ? 'Own commander (no damage)' : `${c.name} has dealt ${dmg} combat damage to ${p.name}${isLethal ? ' — LETHAL (21+)' : ''}`}
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
        <span className="cdm-footer-hint">Combat damage from a single commander ≥21 is lethal.</span>
      </div>
    </div>
  )
}
