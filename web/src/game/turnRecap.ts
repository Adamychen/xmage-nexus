import type { CardView, GameView, PermanentView, PlayerView } from '../net/types'
import { stringList } from '../state/gameUtils'
import { cardName, isAbilityCard } from '../cards/cardImages'

export type RecapDestination = 'graveyard' | 'exile' | 'hand' | 'gone'
export type RecapMark = 'new' | 'changed'

export interface RecapDeparture {
  id: string
  card: CardView
  dest: RecapDestination
  mine: boolean
}

export interface RecapActor {
  playerId: string
  name: string
  played: string[]
  attackedWith: string[]
}

export interface RecapLifeChange {
  playerId: string
  name: string
  mine: boolean
  delta: number
}

export interface TurnRecap {
  key: string
  turn: number
  turnsOf: string[]
  actors: RecapActor[]
  life: RecapLifeChange[]
  departures: RecapDeparture[]
  marks: Record<string, RecapMark>
}

interface ActorAcc {
  name: string
  played: Map<string, string>
  attackedWith: Map<string, string>
}

interface Window {
  baseline: GameView
  turnsOf: string[]
  actors: Map<string, ActorAcc>
  departures: Map<string, RecapDeparture>
}

let trackedGameId: string | null = null
let open: Window | null = null

export function resetTurnRecap(gameId: string | null = null): void {
  trackedGameId = gameId
  open = null
}

function meOf(game: GameView): PlayerView | undefined {
  return game.players?.find((p) => p.controlled)
}

function isMyTurn(game: GameView, me: PlayerView): boolean {
  if (game.activePlayerId) return game.activePlayerId === me.playerId
  return me.isActive === true
}

function hasType(card: CardView, type: string): boolean {
  return (card.cardTypes ?? []).some((t) => String(t).toUpperCase() === type)
}

function battlefieldIndex(game: GameView): Map<string, { perm: PermanentView; player: PlayerView }> {
  const index = new Map<string, { perm: PermanentView; player: PlayerView }>()
  for (const player of game.players ?? []) {
    for (const [id, perm] of Object.entries(player.battlefield ?? {})) index.set(id, { perm, player })
  }
  return index
}

function destinationOf(game: GameView, id: string, card: CardView): RecapDestination {
  for (const p of game.players ?? []) {
    if (p.graveyard && id in p.graveyard) return 'graveyard'
    if (p.exile && id in p.exile) return 'exile'
  }
  if ((game.exiles ?? []).some((zone) => zone.cards && id in zone.cards)) return 'exile'
  if (game.myHand && id in game.myHand) return 'hand'
  if (Object.values(game.opponentHands ?? {}).some((hand) => hand && id in hand)) return 'hand'
  return card.isToken ? 'graveyard' : 'gone'
}

function actorFor(win: Window, game: GameView, playerId: string | undefined, playerName: string | undefined): ActorAcc | null {
  const player = game.players?.find((p) => (playerId && p.playerId === playerId) || (playerName && p.name === playerName))
  if (!player || player.controlled) return null
  let acc = win.actors.get(player.playerId)
  if (!acc) {
    acc = { name: player.name, played: new Map(), attackedWith: new Map() }
    win.actors.set(player.playerId, acc)
  }
  return acc
}

function attackerIds(game: GameView): string[] {
  const ids: string[] = []
  for (const group of game.combat ?? []) ids.push(...stringList((group as { attackers?: unknown }).attackers))
  return ids
}

function accumulate(win: Window, prev: GameView, next: GameView): void {
  const active = next.players?.find((p) => p.playerId === next.activePlayerId) ?? next.players?.find((p) => p.isActive)
  if (active && !active.controlled && !win.turnsOf.includes(active.name)) win.turnsOf.push(active.name)

  const prevStack = prev.stack ?? {}
  for (const [id, item] of Object.entries(next.stack ?? {})) {
    if (id in prevStack || isAbilityCard(item)) continue
    const acc = actorFor(win, next, item.controllerId ?? item.sourceCard?.controllerId, item.controllerName ?? item.sourceCard?.controllerName)
    acc?.played.set(id, cardName(item))
  }

  const before = battlefieldIndex(prev)
  const after = battlefieldIndex(next)

  for (const [id, { perm, player }] of after) {
    win.departures.delete(id)
    if (before.has(id) || perm.isToken || !hasType(perm, 'LAND')) continue
    const acc = actorFor(win, next, player.playerId, player.name)
    acc?.played.set(id, cardName(perm))
  }

  for (const [id, { perm, player }] of before) {
    if (after.has(id)) continue
    win.departures.set(id, { id, card: perm, dest: destinationOf(next, id, perm), mine: player.controlled === true })
  }

  const prevAttackers = new Set(attackerIds(prev))
  for (const id of attackerIds(next)) {
    if (prevAttackers.has(id)) continue
    const entry = after.get(id)
    if (!entry) continue
    const acc = actorFor(win, next, entry.player.playerId, entry.player.name)
    acc?.attackedWith.set(id, cardName(entry.perm))
  }
}

function counterSignature(card: CardView): string {
  return (card.counters ?? []).map((c) => `${c.name}:${c.count}`).sort().join('|')
}

function changed(a: PermanentView, b: PermanentView): boolean {
  return a.power !== b.power || a.toughness !== b.toughness || a.loyalty !== b.loyalty || counterSignature(a) !== counterSignature(b)
}

function close(win: Window, now: GameView, key: string): TurnRecap | null {
  const before = battlefieldIndex(win.baseline)
  const after = battlefieldIndex(now)

  const marks: Record<string, RecapMark> = {}
  for (const [id, { perm, player }] of after) {
    const old = before.get(id)
    if (!old) marks[id] = 'new'
    else if (old.player.playerId !== player.playerId || changed(old.perm, perm)) marks[id] = 'changed'
  }

  const life: RecapLifeChange[] = []
  for (const p of now.players ?? []) {
    const old = win.baseline.players?.find((q) => q.playerId === p.playerId)
    if (!old || typeof old.life !== 'number' || typeof p.life !== 'number') continue
    const delta = p.life - old.life
    if (delta !== 0) life.push({ playerId: p.playerId, name: p.name, mine: p.controlled === true, delta })
  }
  life.sort((a, b) => Number(b.mine) - Number(a.mine))

  const actors: RecapActor[] = [...win.actors.entries()]
    .map(([playerId, acc]) => ({ playerId, name: acc.name, played: [...acc.played.values()], attackedWith: [...acc.attackedWith.values()] }))
    .filter((a) => a.played.length > 0 || a.attackedWith.length > 0)

  const departures = [...win.departures.values()].filter((d) => !after.has(d.id))

  if (actors.length === 0 && life.length === 0 && departures.length === 0 && Object.keys(marks).length === 0) return null
  return { key, turn: now.turn, turnsOf: win.turnsOf, actors, life, departures, marks }
}

export function observeTurnRecap(prev: GameView | null, next: GameView, gameId: string | null): TurnRecap | null {
  if (gameId !== trackedGameId) resetTurnRecap(gameId)
  const me = meOf(next)
  if (!me) return null

  if (!isMyTurn(next, me)) {
    if (!open) {
      open = { baseline: next, turnsOf: [], actors: new Map(), departures: new Map() }
      const active = next.players?.find((p) => p.playerId === next.activePlayerId) ?? next.players?.find((p) => p.isActive)
      if (active && !active.controlled) open.turnsOf.push(active.name)
      return null
    }
    if (prev) accumulate(open, prev, next)
    return null
  }

  if (!open) return null
  const win = open
  open = null
  if (prev) accumulate(win, prev, next)
  return close(win, next, `${gameId ?? ''}:${next.turn}`)
}
