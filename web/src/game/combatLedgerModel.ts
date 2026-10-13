import type { GameView, PlayerView } from '../net/types'
import type { ActionFeedItem } from './gameEventParser'
import { syncCommanderMemory } from '../board/commanders'
import { commanderDamageChips } from './commanderChips'

export interface LedgerRow {
  source: string
  target: string
  amount: number
  toPlayer: boolean
  commander: boolean
  sourceOwnerId: string | null
  targetOwnerId: string | null
  commanderTotal: number | null
}

export interface LedgerPlayerTotal {
  name: string
  amount: number
  playerId: string | null
  lifeAfter: number | null
}

export interface CombatLedger {
  attacker: string | null
  rows: LedgerRow[]
  totals: LedgerPlayerTotal[]
}

const norm = (name: string) => name.trim().toLowerCase()

function ownerOfCard(players: readonly PlayerView[], name: string): string | null {
  const key = norm(name)
  for (const p of players) {
    for (const perm of Object.values(p.battlefield ?? {})) {
      if (norm(perm.displayName || perm.name || '') === key || norm(perm.name || '') === key) return p.playerId
    }
  }
  return null
}

export const LEDGER_STEPS: ReadonlySet<string> = new Set([
  'FIRST_COMBAT_DAMAGE',
  'COMBAT_DAMAGE',
  'END_COMBAT',
])

export function ledgerWindowOpen(step: string | null | undefined): boolean {
  return !!step && LEDGER_STEPS.has(step)
}

export function buildCombatLedger(items: readonly ActionFeedItem[], game: GameView | null | undefined): CombatLedger | null {
  let start = -1
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i].type === 'turn') break
    if (items[i].type === 'attack') {
      start = i
      break
    }
  }
  if (start < 0) return null

  const players = game?.players ?? []
  const playerByName = new Map(players.map((p) => [norm(p.name), p]))
  const commanders = syncCommanderMemory(game ?? null)
  const commanderOwner = new Map(commanders.map((c) => [norm(c.name), c.ownerId]))

  const merged = new Map<string, LedgerRow>()
  for (const item of items.slice(start + 1)) {
    if (item.type === 'turn') break
    if (item.type !== 'damage' || !item.cardName || !item.targetName || !item.amount) continue
    const key = `${item.cardName}\u0000${item.targetName}`
    const existing = merged.get(key)
    if (existing) {
      existing.amount += item.amount
      continue
    }
    const targetPlayer = playerByName.get(norm(item.targetName))
    const commander = commanderOwner.has(norm(item.cardName))
    merged.set(key, {
      source: item.cardName,
      target: item.targetName,
      amount: item.amount,
      toPlayer: !!targetPlayer,
      commander,
      sourceOwnerId: ownerOfCard(players, item.cardName) ?? commanderOwner.get(norm(item.cardName)) ?? null,
      targetOwnerId: targetPlayer?.playerId ?? ownerOfCard(players, item.targetName),
      commanderTotal: null,
    })
  }
  const rows = [...merged.values()]
  if (rows.length === 0) return null

  for (const row of rows) {
    if (!row.commander || !row.toPlayer) continue
    const target = playerByName.get(norm(row.target))
    const chip = target ? commanderDamageChips(game, target).find((c) => norm(c.commander.name) === norm(row.source)) : undefined
    row.commanderTotal = chip?.dmg ?? null
  }

  const byPlayer = new Map<string, number>()
  for (const row of rows) {
    if (row.toPlayer) byPlayer.set(row.target, (byPlayer.get(row.target) ?? 0) + row.amount)
  }
  const totals = [...byPlayer.entries()].map(([name, amount]) => {
    const p = playerByName.get(norm(name))
    return { name, amount, playerId: p?.playerId ?? null, lifeAfter: p?.life ?? null }
  })
  return { attacker: items[start].playerName ?? null, rows, totals }
}
