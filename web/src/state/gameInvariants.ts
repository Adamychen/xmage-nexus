export interface PlayerLike {
  playerId?: unknown
  name?: unknown
  handCount?: unknown
  libraryCount?: unknown
  battlefield?: unknown
  graveyard?: unknown
  exile?: unknown
  commandList?: unknown
  sideboard?: unknown
}

export interface GameViewLike {
  players?: PlayerLike[]
  myPlayerId?: unknown
  stack?: unknown
  exiles?: unknown
  myHand?: unknown
  opponentHands?: unknown
  revealed?: unknown
  lookedAt?: unknown
  companion?: unknown
  watchedHands?: unknown
}

export interface Ownership {
  id: string
  zone: string
}

export interface CountMismatch {
  player: string
  zone: string
  reported: number
  visible: number
}

function idsOfDict(d: unknown): string[] {
  if (!d || typeof d !== 'object') return []
  const o = d as Record<string, unknown>
  if ('cards' in o && o.cards && typeof o.cards === 'object') {
    return Object.keys(o.cards as Record<string, unknown>)
  }
  return Object.keys(o)
}

function idsOfList(arr: unknown): string[] {
  if (!Array.isArray(arr)) return []
  const out: string[] = []
  for (const item of arr) {
    if (typeof item === 'string') {
      out.push(item)
    } else if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>
      if (typeof o.id === 'string') out.push(o.id)
      if (o.cards && typeof o.cards === 'object') {
        out.push(...Object.keys(o.cards as Record<string, unknown>))
      }
    }
  }
  return out
}

export function owningZoneEntries(view: GameViewLike): Ownership[] {
  const out: Ownership[] = []
  const add = (zone: string, ids: string[]) => {
    for (const id of ids) out.push({ id, zone })
  }
  const players = Array.isArray(view.players) ? view.players : []
  for (let i = 0; i < players.length; i++) {
    const p = players[i]
    const who = typeof p?.name === 'string' ? p.name : `player#${i}`
    add(`${who}.battlefield`, idsOfDict(p?.battlefield))
    add(`${who}.graveyard`, idsOfDict(p?.graveyard))
    add(`${who}.exile`, idsOfDict(p?.exile))
    add(`${who}.sideboard`, idsOfDict(p?.sideboard))
    add(`${who}.commandList`, idsOfList(p?.commandList))
  }
  add('stack', idsOfDict(view.stack))
  add('myHand', idsOfDict(view.myHand))
  const opp = view.opponentHands
  if (opp && typeof opp === 'object') {
    for (const [playerId, hand] of Object.entries(opp as Record<string, unknown>)) {
      for (const id of idsOfDict(hand)) out.push({ id, zone: `opponentHands(${playerId})` })
    }
  }
  for (const zone of ['revealed', 'lookedAt', 'companion'] as const) {
    add(zone, idsOfList(view[zone]))
  }
  add('watchedHands', idsOfDict(view.watchedHands))
  return out
}

export function findDuplicateOwnership(view: GameViewLike): Ownership[] {
  const seen = new Map<string, string>()
  const dups: Ownership[] = []
  for (const { id, zone } of owningZoneEntries(view)) {
    const prev = seen.get(id)
    if (prev !== undefined && prev !== zone) dups.push({ id, zone })
    else if (prev === undefined) seen.set(id, zone)
  }
  return dups
}

export function checkZoneCounts(view: GameViewLike): CountMismatch[] {
  const mismatches: CountMismatch[] = []
  const players = Array.isArray(view.players) ? view.players : []
  for (let i = 0; i < players.length; i++) {
    const p = players[i]
    const who = typeof p?.name === 'string' ? p.name : `player#${i}`
    const reported = typeof p?.handCount === 'number' ? p.handCount : undefined
    if (reported === undefined) continue
    const isSelf = p?.playerId != null && p.playerId === view.myPlayerId
    const visible = isSelf ? idsOfDict(view.myHand).length : idsOfDict(
      typeof view.opponentHands === 'object' && view.opponentHands
        ? (view.opponentHands as Record<string, unknown>)[String(p.playerId)]
        : undefined,
    ).length
    if (isSelf ? visible !== reported : visible > reported) {
      mismatches.push({ player: who, zone: 'hand', reported, visible })
    }
  }
  return mismatches
}
