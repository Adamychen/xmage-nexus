import type { CardView, GameView, PermanentView, PlayerView } from '../net/types'
import type { PoolKey } from './manaPayment'

export type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G' | 'C'

export interface ManaPip {
  options: ManaColor[]
}

export interface ParsedCost {
  generic: number
  pips: ManaPip[]
  unresolved: string[]
}

export interface ManaSource {
  key: string
  kind: 'pool' | 'tap'
  poolColor?: PoolKey
  id?: string
  produces: ManaColor[]
}

export type ManaAction =
  | { kind: 'payPool'; color: PoolKey }
  | { kind: 'tapPermanent'; id: string }

const COLORED: ManaColor[] = ['W', 'U', 'B', 'R', 'G']
const ALL_COLORS: ManaColor[] = ['W', 'U', 'B', 'R', 'G', 'C']

const POOL_LETTER: Record<PoolKey, ManaColor> = {
  white: 'W',
  blue: 'U',
  black: 'B',
  red: 'R',
  green: 'G',
  colorless: 'C',
}

const isColor = (s: string): s is ManaColor => (ALL_COLORS as string[]).includes(s)
const isColored = (s: string): s is ManaColor => (COLORED as string[]).includes(s)

export function parseRemainingManaCost(message: string): ParsedCost {
  const cost: ParsedCost = { generic: 0, pips: [], unresolved: [] }
  for (const match of (message ?? '').matchAll(/\{([^}]+)\}/g)) {
    const token = match[1].trim().toUpperCase()
    const hybrid = /^([WUBRG])\/([WUBRG])$/.exec(token)
    const phyrexian = /^([WUBRG])\/P$/.exec(token)
    if (/^\d+$/.test(token)) cost.generic += Number(token)
    else if (isColor(token)) cost.pips.push({ options: [token] })
    else if (hybrid) cost.pips.push({ options: [hybrid[1] as ManaColor, hybrid[2] as ManaColor] })
    else if (phyrexian) cost.pips.push({ options: [phyrexian[1] as ManaColor] })
    else cost.unresolved.push(token)
  }
  return cost
}

const TAP_ADD_RE = /^\{T\}:\s*Add\s+(.+?)\.?$/i

function producedColors(rule: string): ManaColor[] | null {
  const m = TAP_ADD_RE.exec(rule.trim())
  if (!m) return null
  const body = m[1].trim()
  if (/^one mana of any color$/i.test(body)) return [...COLORED]
  const colors: ManaColor[] = []
  for (const part of body.split(/\s*,\s*(?:or\s+)?|\s+or\s+/i)) {
    const sym = /^\{([WUBRGC])\}$/i.exec(part.trim())
    if (!sym) return null
    colors.push(sym[1].toUpperCase() as ManaColor)
  }
  return colors.length > 0 ? colors : null
}

function tapColorsOf(perm: PermanentView): ManaColor[] {
  if (perm.tapped === true || perm.phasedIn === false) return []
  const isCreature = (perm.cardTypes ?? []).some((t) => t.toUpperCase() === 'CREATURE')
  if (isCreature && perm.summoningSickness === true) return []
  const out = new Set<ManaColor>()
  for (const rule of perm.rules ?? []) for (const c of producedColors(rule) ?? []) out.add(c)
  return [...out]
}

function battlefieldEntries(player: PlayerView): [string, PermanentView][] {
  const bf = player.battlefield as unknown
  if (Array.isArray(bf)) {
    return (bf as PermanentView[]).flatMap((p): [string, PermanentView][] => {
      const id = p.id ?? p.parentId
      return id ? [[id, p]] : []
    })
  }
  return Object.entries((bf ?? {}) as Record<string, PermanentView>)
}

export function ownManaSources(me: PlayerView, pool: Record<PoolKey, number>): ManaSource[] {
  const sources: ManaSource[] = []
  for (const color of Object.keys(POOL_LETTER) as PoolKey[]) {
    for (let i = 0; i < (pool[color] ?? 0); i++) {
      sources.push({ key: `pool:${color}:${i}`, kind: 'pool', poolColor: color, produces: [POOL_LETTER[color]] })
    }
  }
  for (const [id, perm] of battlefieldEntries(me)) {
    const produces = tapColorsOf(perm)
    if (produces.length > 0) sources.push({ key: `tap:${id}`, kind: 'tap', id, produces })
  }
  return sources
}

export function opponentOpenManaCount(game: GameView): number {
  let count = 0
  for (const player of game.players ?? []) {
    if (player.controlled) continue
    for (const [, perm] of battlefieldEntries(player)) if (tapColorsOf(perm).length > 0) count++
  }
  return count
}

export function reservedColorsForInstants(hand: Record<string, CardView>): Set<ManaColor> {
  const reserved = new Set<ManaColor>()
  for (const card of Object.values(hand ?? {})) {
    const instantSpeed =
      (card.cardTypes ?? []).some((t) => t.toUpperCase() === 'INSTANT') ||
      (card.rules ?? []).some((r) => /\bflash\b/i.test(r))
    if (!instantSpeed) continue
    const cost = parseRemainingManaCost((card.manaCostLeftStr ?? []).join(''))
    for (const pip of cost.pips) for (const c of pip.options) if (isColored(c)) reserved.add(c)
  }
  return reserved
}

const OPPONENT_OPEN_WEIGHT = 0.25

function spendScores(
  sources: ManaSource[],
  reserved: Set<ManaColor>,
  opponentOpenMana: number,
): Map<string, number> {
  const producers: Record<string, number> = {}
  for (const s of sources) if (s.kind === 'tap') for (const c of s.produces) producers[c] = (producers[c] ?? 0) + 1
  const pressure = 1 + Math.max(0, opponentOpenMana) * OPPONENT_OPEN_WEIGHT
  const scores = new Map<string, number>()
  for (const s of sources) {
    if (s.kind === 'pool') {
      scores.set(s.key, -1000)
      continue
    }
    let score = s.produces.length * 10
    if (s.produces.length === 1 && s.produces[0] === 'C') score -= 5
    for (const c of s.produces) {
      if (!reserved.has(c)) continue
      const left = producers[c] ?? 0
      score += (left <= 1 ? 100 : 10 / left) * pressure
    }
    scores.set(s.key, score)
  }
  return scores
}

export function computeNextManaAction(
  cost: ParsedCost,
  sources: ManaSource[],
  reserved: Set<ManaColor> = new Set(),
  opponentOpenMana = 0,
): ManaAction | null {
  if (cost.unresolved.length > 0) return null
  if (cost.pips.length === 0 && cost.generic === 0) return null
  if (sources.length < cost.pips.length + cost.generic) return null

  const scores = spendScores(sources, reserved, opponentOpenMana)
  const ranked = [...sources].sort((a, b) => (scores.get(a.key)! - scores.get(b.key)!) || a.key.localeCompare(b.key))
  const eligible = (pip: ManaPip) => ranked.filter((s) => s.produces.some((c) => pip.options.includes(c)))

  const pipOrder = cost.pips
    .map((pip, index) => ({ pip, index, candidates: eligible(pip) }))
    .sort((a, b) => a.candidates.length - b.candidates.length || a.index - b.index)

  const owner = new Map<string, number>()
  const visit = (pipIndex: number, seen: Set<string>): boolean => {
    for (const source of pipOrder[pipIndex].candidates) {
      if (seen.has(source.key)) continue
      seen.add(source.key)
      const holder = owner.get(source.key)
      if (holder === undefined || visit(holder, seen)) {
        owner.set(source.key, pipIndex)
        return true
      }
    }
    return false
  }
  for (let i = 0; i < pipOrder.length; i++) if (!visit(i, new Set())) return null

  const sourceByKey = new Map(sources.map((s) => [s.key, s]))
  const assigned = ranked.filter((s) => owner.has(s.key))
  const first = assigned.length > 0 ? assigned[0] : ranked.find((s) => !owner.has(s.key))
  const chosen = first ? sourceByKey.get(first.key)! : null
  if (!chosen) return null
  return chosen.kind === 'pool'
    ? { kind: 'payPool', color: chosen.poolColor as PoolKey }
    : { kind: 'tapPermanent', id: chosen.id as string }
}

export function nextSmartManaAction(game: GameView, message: string, pool: Record<PoolKey, number>): ManaAction | null {
  const me = (game.players ?? []).find((p) => p.controlled)
  if (!me) return null
  return computeNextManaAction(
    parseRemainingManaCost(message),
    ownManaSources(me, pool),
    reservedColorsForInstants(game.myHand ?? {}),
    opponentOpenManaCount(game),
  )
}
