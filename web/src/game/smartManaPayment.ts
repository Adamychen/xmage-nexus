import type { CardView, GameView, PermanentView, PlayerView } from '../net/types'
import { commandersOf } from '../board/commanders'
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
  /** Mana one activation adds. Only the feasibility count reads it (MNA-13): a pip is still
   *  matched one per source, and the surplus of a Sol Ring lands in the pool, where the next
   *  prompt already sees it as a pool source. */
  amount: number
  painful: boolean
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

/** A tap-for-mana ability of any shape, extra costs included (`{T}, Sacrifice this artifact:`).
 *  What it adds may be unreadable, but the permanent announces itself as a mana source all the
 *  same: MNA-13 counts these so one wording the solver cannot read never makes a payable cost
 *  look hopeless. */
const TAP_ADD_LOOSE = /^\{T\}[^:]*:\s*Add\s/i
/** The only shape a source can be modelled from: tapping and nothing else. */
const TAP_ADD_RE = /^\{T\}:\s*Add\s+(.+)$/i
/** Conditional mana (Cavern of Souls): the engine would take the tap and the mana it made could
 *  not pay this cost. A trailing sentence that only grants a bonus, as Path of Ancestry's scry
 *  does, is not one of these. */
const SPEND_ONLY_RE = /\bSpend this mana only\b/i
/** A run of symbols with no separator: `{G}`, and `{C}{C}` for the two mana of a Sol Ring. */
const SYMBOL_RUN_RE = /^(?:\{[WUBRGC]\})+$/i

/** The engine writes a plain apostrophe, but a rule can reach the view escaped or curled. */
const normalize = (text: string) =>
  text.replace(/&(?:apos|#0*39|rsquo|#8217);/gi, "'").replace(/[‘’ʼ]/g, "'")

export interface ManaContext {
  /** Colours of the player's commanders, for "in your commander's color identity". */
  commanderIdentity: ManaColor[]
  /** The permanent's own colours, for "any of this creature's colors" (Katilda). */
  ownColors: ManaColor[]
}

/** The mana one activation of `rule` adds, or null when the wording cannot be modelled. */
function producedMana(rule: string, ctx: ManaContext): { colors: ManaColor[]; amount: number } | null {
  const m = TAP_ADD_RE.exec(normalize(rule).trim())
  if (!m) return null
  if (SPEND_ONLY_RE.test(m[1])) return null
  const dot = m[1].indexOf('.')
  const clause = (dot < 0 ? m[1] : m[1].slice(0, dot)).trim()
  const pick = (colors: ManaColor[]) => (colors.length > 0 ? { colors: [...colors], amount: 1 } : null)
  if (/^one mana of any color$/i.test(clause)) return pick([...COLORED])
  if (/^one mana of any color in your commander's color identity$/i.test(clause)) return pick(ctx.commanderIdentity)
  if (/^one mana of any of this creature's colors$/i.test(clause)) return pick(ctx.ownColors)
  const compact = clause.replace(/\s+/g, '')
  if (SYMBOL_RUN_RE.test(compact)) {
    const symbols = [...compact.matchAll(/\{([WUBRGC])\}/gi)].map((s) => s[1].toUpperCase() as ManaColor)
    return { colors: [...new Set(symbols)], amount: symbols.length }
  }
  const colors: ManaColor[] = []
  for (const part of clause.split(/\s*,\s*(?:or\s+)?|\s+or\s+/i)) {
    const symbol = /^\{([WUBRGC])\}$/i.exec(part.trim())
    if (!symbol) return null
    colors.push(symbol[1].toUpperCase() as ManaColor)
  }
  return pick([...new Set(colors)])
}

function canTap(perm: PermanentView): boolean {
  if (perm.tapped === true || perm.phasedIn === false) return false
  const isCreature = (perm.cardTypes ?? []).some((t) => t.toUpperCase() === 'CREATURE')
  return !(isCreature && perm.summoningSickness === true)
}

function ownColorsOf(perm: PermanentView): ManaColor[] {
  const color = perm.color
  if (!color) return []
  const out: ManaColor[] = []
  if (color.white) out.push('W')
  if (color.blue) out.push('U')
  if (color.black) out.push('B')
  if (color.red) out.push('R')
  if (color.green) out.push('G')
  return out
}

/** The colours of a player's commanders, read wherever the engine's own marker finds them
 *  (`commandersOf`): `commandList` holds a commander only while it waits in the command zone,
 *  and the rest of the game is played after the first cast. Partners contribute one identity
 *  each. */
export function commanderIdentityOf(player: PlayerView | undefined): ManaColor[] {
  const out = new Set<ManaColor>()
  for (const commander of commandersOf(player)) {
    if (!commander.isCommander) continue
    for (const match of (commander.card?.originalColorIdentity ?? '').matchAll(/\{([WUBRG])\}/g)) {
      out.add(match[1] as ManaColor)
    }
  }
  return [...out]
}

/** What one tap of `perm` can produce, and how much of it. */
function tapManaOf(perm: PermanentView, identity: ManaColor[]): { colors: ManaColor[]; amount: number } | null {
  if (!canTap(perm)) return null
  const ctx: ManaContext = { commanderIdentity: identity, ownColors: ownColorsOf(perm) }
  const colors = new Set<ManaColor>()
  let amount = 0
  for (const rule of perm.rules ?? []) {
    const produced = producedMana(rule, ctx)
    if (!produced) continue
    for (const color of produced.colors) colors.add(color)
    amount = Math.max(amount, produced.amount)
  }
  return colors.size > 0 ? { colors: [...colors], amount } : null
}

function tapColorsOf(perm: PermanentView, identity: ManaColor[] = []): ManaColor[] {
  return tapManaOf(perm, identity)?.colors ?? []
}

const PAIN_TO_YOU_RE = /deals?\s+\d*\s*damage to you|lose[sd]?\s+(\d+\s+)?life/i

function tapPainOf(perm: PermanentView): boolean {
  const rules = perm.rules ?? []
  if (!rules.some((r) => TAP_ADD_RE.test(normalize(r).trim()))) return false
  return rules.some((r) => PAIN_TO_YOU_RE.test(r))
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
      sources.push({ key: `pool:${color}:${i}`, kind: 'pool', poolColor: color, produces: [POOL_LETTER[color]], amount: 1, painful: false })
    }
  }
  const identity = commanderIdentityOf(me)
  for (const [id, perm] of battlefieldEntries(me)) {
    const produced = tapManaOf(perm, identity)
    if (!produced) continue
    sources.push({ key: `tap:${id}`, kind: 'tap', id, produces: produced.colors, amount: produced.amount, painful: tapPainOf(perm) })
  }
  return sources
}

/** MNA-13: untapped permanents that announce a tap-for-mana ability the solver could not read.
 *  They are never spent, they only keep an unreadable wording from making a payable cost look
 *  hopeless. */
export function unknownManaSourceCount(me: PlayerView): number {
  const identity = commanderIdentityOf(me)
  let count = 0
  for (const [, perm] of battlefieldEntries(me)) {
    if (!canTap(perm)) continue
    if (tapManaOf(perm, identity)) continue
    if ((perm.rules ?? []).some((r) => TAP_ADD_LOOSE.test(normalize(r).trim()))) count++
  }
  return count
}

export function opponentOpenManaCount(game: GameView): number {
  let count = 0
  for (const player of game.players ?? []) {
    if (player.controlled) continue
    const identity = commanderIdentityOf(player)
    for (const [, perm] of battlefieldEntries(player)) if (tapColorsOf(perm, identity).length > 0) count++
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
  unknownSources = 0,
): ManaAction | null {
  if (cost.unresolved.length > 0) return null
  if (cost.pips.length === 0 && cost.generic === 0) return null
  // MNA-13: a Sol Ring counts for the two mana it makes, and a wording the solver cannot read
  // counts for one, so only a cost nothing on the board could cover is left untouched.
  const capacity = sources.reduce((total, s) => total + s.amount, 0) + unknownSources
  if (capacity < cost.pips.length + cost.generic) return null

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
  // MNA-13: a maximum matching, not a perfect one. Pips no known source covers are left to the
  // player instead of stopping the whole payment.
  let matched = 0
  for (let i = 0; i < pipOrder.length; i++) if (visit(i, new Set())) matched++
  if (matched === 0 && cost.generic === 0) return null

  const sourceByKey = new Map(sources.map((s) => [s.key, s]))
  const assigned = ranked.filter((s) => owner.has(s.key))
  const unassigned = ranked.filter((s) => !owner.has(s.key))
  const first = assigned.length > 0 ? assigned[0] : (unassigned.find((s) => !s.painful) ?? unassigned[0])
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
    unknownManaSourceCount(me),
  )
}
