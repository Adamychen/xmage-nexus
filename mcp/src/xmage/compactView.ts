import type { CardView, GameView, PermanentView, PlayerView } from '../../../web/src/net/types.generated.ts'

const BASIC_LANDS = ['Mountain', 'Plains', 'Island', 'Swamp', 'Forest']

export interface CompactCard {
  id: string
  name: string
  manaCost?: string
  types?: string
  power?: string
  toughness?: string
  tapped?: boolean
  damage?: number
  counters?: Record<string, number>
  summoningSickness?: boolean
  canAttack?: boolean
  canBlock?: boolean
  playable?: boolean
  controller?: string
}

export interface CompactPlayer {
  playerId: string
  name: string
  life: number
  handCount: number
  libraryCount: number
  graveyardCount: number
  exileCount: number
  isActive: boolean
  hasPriority: boolean
  manaPool?: Record<string, number>
}

export interface CompactGame {
  turn: number
  phase: string | null
  step: string | null
  activePlayer: string
  priorityPlayer: string
  myTurn: boolean
  myPriority: boolean
  me: CompactPlayer | null
  opponents: CompactPlayer[]
  hand: CompactCard[]
  battlefield: { mine: CompactCard[]; theirs: CompactCard[] }
  stack: CompactCard[]
  playableIds: string[]
  combat: { attackers: string[]; blockers: string[] }
}

function counterMap(counters: unknown): Record<string, number> | undefined {
  if (!Array.isArray(counters)) return undefined
  const out: Record<string, number> = {}
  for (const item of counters) {
    const record = item as { name?: unknown; count?: unknown }
    const name = typeof record.name === 'string' ? record.name : undefined
    const count = typeof record.count === 'number' ? record.count : Number(record.count)
    if (name && Number.isFinite(count) && count !== 0) out[name] = count
  }
  return Object.keys(out).length ? out : undefined
}

function cardTypes(card: CardView | PermanentView): string | undefined {
  const types = Array.isArray(card.cardTypes) ? card.cardTypes : []
  const subTypes = Array.isArray(card.subTypes) ? (card.subTypes as string[]) : []
  const line = [...types, ...subTypes].join(' ')
  return line || undefined
}

function compactCard(id: string, card: CardView | PermanentView, playable: Set<string>): CompactCard {
  const permanent = card as PermanentView
  const manaCost = Array.isArray(card.manaCostLeftStr) ? card.manaCostLeftStr.join('') : ''
  return {
    id,
    name: card.displayName ?? card.name ?? id,
    manaCost: manaCost || undefined,
    types: cardTypes(card),
    power: card.power,
    toughness: card.toughness,
    tapped: permanent.tapped,
    damage: typeof permanent.damage === 'number' && permanent.damage > 0 ? permanent.damage : undefined,
    counters: counterMap(card.counters),
    summoningSickness: permanent.summoningSickness === true ? true : undefined,
    canAttack: card.canAttack === true ? true : undefined,
    canBlock: card.canBlock === true ? true : undefined,
    playable: playable.has(id) ? true : undefined,
    controller: card.controllerName ?? undefined,
  }
}

function compactZone(zone: Record<string, CardView> | undefined, playable: Set<string>): CompactCard[] {
  if (!zone) return []
  return Object.entries(zone).map(([id, card]) => compactCard(id, card, playable))
}

function manaPoolOf(player: PlayerView): Record<string, number> | undefined {
  const pool = player.manaPool
  if (!pool) return undefined
  const out: Record<string, number> = {}
  for (const [color, value] of Object.entries(pool)) {
    if (typeof value === 'number' && value > 0) out[color] = value
  }
  return Object.keys(out).length ? out : undefined
}

function zoneCardCount(zone: Record<string, CardView> | CardView[] | undefined): number {
  if (!zone) return 0
  return Array.isArray(zone) ? zone.length : Object.keys(zone).length
}

function compactPlayer(player: PlayerView, exileFallback: number): CompactPlayer {
  const exileCount = zoneCardCount(player.exile as Record<string, CardView> | CardView[] | undefined)
  return {
    playerId: player.playerId,
    name: player.name,
    life: player.life,
    handCount: player.handCount,
    libraryCount: player.libraryCount,
    graveyardCount: Object.keys(player.graveyard ?? {}).length,
    // El mapa `exile` del jugador puede venir vacío para no-controladores
    // (la carta sí viaja en el `exiles[]` global): derivar del array entonces.
    exileCount: exileCount > 0 ? exileCount : exileFallback,
    isActive: player.isActive === true,
    hasPriority: player.hasPriority === true,
    manaPool: manaPoolOf(player),
  }
}

function combatActors(game: GameView, key: 'attackers' | 'blockers'): string[] {
  const ids: string[] = []
  for (const group of game.combat ?? []) {
    const record = group as unknown as Record<string, unknown>
    const bucket = record[key]
    ids.push(...(Array.isArray(bucket) ? bucket : Object.keys((bucket ?? {}) as Record<string, unknown>)))
  }
  return ids
}

export function compactGameView(game: GameView): CompactGame {
  const players = game.players ?? []
  const me = players.find((player) => player.controlled === true) ?? null
  const playable = new Set(Object.keys(game.canPlayObjects?.objects ?? {}))
  if (me?.isActive === true && me.hasPriority === true && game.phase === 'PRECOMBAT_MAIN') {
    for (const [id, card] of Object.entries(game.myHand ?? {})) {
      if (BASIC_LANDS.includes(card.name) || BASIC_LANDS.includes(card.displayName ?? '')) playable.add(id)
    }
  }
  const mine: CompactCard[] = []
  const theirs: CompactCard[] = []
  for (const player of players) {
    const target = player.controlled === true ? mine : theirs
    for (const [id, card] of Object.entries(player.battlefield ?? {})) {
      target.push(compactCard(id, card, playable))
    }
  }
  const exiledTotal = (game.exiles ?? []).reduce(
    (acc, zone) => acc + zoneCardCount(zone?.cards as Record<string, CardView> | CardView[] | undefined),
    0,
  )
  return {
    turn: game.turn,
    phase: game.phase,
    step: game.step,
    activePlayer: game.activePlayerName,
    priorityPlayer: game.priorityPlayerName,
    myTurn: me?.isActive === true,
    myPriority: me?.hasPriority === true,
    me: me ? compactPlayer(me, exiledTotal) : null,
    opponents: players.filter((player) => player.controlled !== true).map((p) => compactPlayer(p, exiledTotal)),
    hand: compactZone(game.myHand, playable),
    battlefield: { mine, theirs },
    stack: compactZone(game.stack, playable),
    playableIds: [...playable],
    combat: { attackers: combatActors(game, 'attackers'), blockers: combatActors(game, 'blockers') },
  }
}
