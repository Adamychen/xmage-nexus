import type { CardView, GameView, PermanentView } from '../net/types'
import { extractOwnedKeywords } from '../data/keywordExtractor'
import { stringList } from '../state/gameUtils'
import { fxMotionDuration } from './fx'
import { spawnImpact } from './impactFx'
import { iconKeywordId } from './cardBadges'
import { combatantRect, planBlockerStrikes, strikeHitKey, strikeKind, strikeTargetElement, type StrikePlan, type StrikeSchedule } from './combatStrikes'
import type { CardIconLike } from './cardIconFx'

export const LIFELINK_TRAVEL_MS = 420
export const TRAMPLE_TRAVEL_MS = 260

export interface KeywordStrike {
  attackerId: string
  targetId: string
  firstStrike: boolean
  deathtouchKill: boolean
  lifelinkTo: string | null
  trampleTo: string | null
  fromBlocker?: boolean
}

export interface KeywordHits {
  playerHits: Map<string, number>
  lifeGains: Map<string, number>
}

/** Keyword ids a card or permanent has: its keyword abilities plus the ones its card icons show. */
export function cardKeywordIds(card: unknown): Set<string> {
  const ids = new Set<string>()
  const c = card as (CardView & { cardIcons?: Array<CardIconLike | null> }) | null | undefined
  if (!c) return ids
  for (const kw of extractOwnedKeywords(c)) ids.add(kw.id)
  for (const icon of c.cardIcons ?? []) {
    const id = icon ? iconKeywordId(icon) : undefined
    if (id) ids.add(id)
  }
  return ids
}

interface Located {
  card: PermanentView
  controllerId: string
}

function locate(game: GameView, id: string): Located | null {
  for (const p of game.players ?? []) {
    const perm = (p.battlefield ?? {})[id]
    if (perm) return { card: perm, controllerId: p.playerId }
  }
  return null
}

function onBattlefield(game: GameView, id: string): boolean {
  return (game.players ?? []).some((p) => (p.battlefield ?? {})[id] !== undefined)
}

function inAnyGraveyard(game: GameView, id: string): boolean {
  return (game.players ?? []).some((p) => (p.graveyard ?? {})[id] !== undefined)
}

function lifeOf(game: GameView, playerId: string): number | null {
  const p = (game.players ?? []).find((player) => player.playerId === playerId)
  return typeof p?.life === 'number' ? p.life : null
}

function combatGroupOf(game: GameView, attackerId: string): Record<string, unknown> | undefined {
  const groups = (game.combat ?? []) as Array<Record<string, unknown>>
  return groups.find((g) => stringList(g.attackers).includes(attackerId))
}

function blockedDefender(group: Record<string, unknown> | undefined): string | null {
  if (!group) return null
  return (typeof group.defenderId === 'string' && group.defenderId) || stringList(group.defenders)[0] || null
}

function excessPastBlockers(prevGame: GameView, group: Record<string, unknown>, power: number, deathtouch: boolean): boolean {
  let lethal = 0
  for (const id of stringList(group.blockers)) {
    const blocker = locate(prevGame, id)?.card
    if (!blocker) continue
    const toughness = parseInt(String(blocker.toughness), 10) || 0
    const remaining = Math.max(0, toughness - (blocker.damage ?? 0))
    lethal += deathtouch ? Math.min(remaining, 1) : remaining
  }
  return power > lethal
}

function combatGroups(prevGame: GameView, nextGame: GameView): GameView {
  return (prevGame.combat ?? []).length > 0 ? prevGame : nextGame
}

function isDeathtouchKill(prevGame: GameView, nextGame: GameView, deathtouch: boolean, id: string): boolean {
  return deathtouch
    && onBattlefield(prevGame, id)
    && !onBattlefield(nextGame, id)
    && (inAnyGraveyard(nextGame, id) || locate(prevGame, id)?.card.isToken === true)
}

function lifelinkGain(prevGame: GameView, nextGame: GameView, keywords: Set<string>, controllerId: string): string | null {
  const before = lifeOf(prevGame, controllerId)
  const after = lifeOf(nextGame, controllerId)
  return keywords.has('lifelink') && before !== null && after !== null && after > before ? controllerId : null
}

function permanentMeter(game: GameView, id: string): number | null {
  const card = locate(game, id)?.card
  const n = parseInt(String(card?.loyalty || card?.defense || ''), 10)
  return Number.isFinite(n) ? n : null
}

function damageMeter(prevGame: GameView, nextGame: GameView, id: string): { before: number; after: number } | null {
  const before = lifeOf(prevGame, id) ?? permanentMeter(prevGame, id)
  if (before === null) return null
  const left = onBattlefield(prevGame, id) && !onBattlefield(nextGame, id) ? 0 : null
  const after = lifeOf(nextGame, id) ?? permanentMeter(nextGame, id) ?? left
  return after === null ? null : { before, after }
}

/** The keyword effects of each planned strike: first strike, deathtouch kills, lifelink gains and trample overflow. */
export function planKeywordStrikes(prevGame: GameView, nextGame: GameView, plans: StrikePlan[]): KeywordStrike[] {
  const out: KeywordStrike[] = []
  const skulls = new Set<string>()
  const claimSkull = (id: string) => {
    if (skulls.has(id)) return false
    skulls.add(id)
    return true
  }
  for (const plan of plans) {
    const attacker = locate(prevGame, plan.attackerId) ?? locate(nextGame, plan.attackerId)
    if (!attacker) continue
    const keywords = cardKeywordIds(attacker.card)
    const firstStrike = strikeKind(attacker.card) !== null
    const deathtouch = keywords.has('deathtouch')
    const deathtouchKill = isDeathtouchKill(prevGame, nextGame, deathtouch, plan.targetId) && claimSkull(plan.targetId)
    const lifelinkTo = lifelinkGain(prevGame, nextGame, keywords, attacker.controllerId)

    const group = combatGroupOf(combatGroups(prevGame, nextGame), plan.attackerId)
    const defender = blockedDefender(group)
    const damage = defender ? damageMeter(prevGame, nextGame, defender) : null
    const power = parseInt(String(attacker.card.power), 10)
    const blockedWithoutBlockers = group !== undefined && group.isBlocked === true && stringList(group.blockers).length === 0
    const trampleTo = keywords.has('trample')
      && damage !== null
      && damage.after < damage.before
      && group !== undefined
      && (plan.targetId === defender
        ? blockedWithoutBlockers
        : excessPastBlockers(prevGame, group, power, deathtouch))
      ? defender
      : null

    if (firstStrike || deathtouchKill || lifelinkTo || trampleTo) {
      out.push({ attackerId: plan.attackerId, targetId: plan.targetId, firstStrike, deathtouchKill, lifelinkTo, trampleTo })
    }
    for (const blockerId of stringList(group?.blockers)) {
      if (blockerId !== plan.targetId && isDeathtouchKill(prevGame, nextGame, deathtouch, blockerId) && claimSkull(blockerId)) {
        out.push({ attackerId: plan.attackerId, targetId: blockerId, firstStrike: false, deathtouchKill: true, lifelinkTo: null, trampleTo: null })
      }
    }
  }
  for (const plan of planBlockerStrikes(prevGame, nextGame)) {
    const blocker = locate(prevGame, plan.attackerId) ?? locate(nextGame, plan.attackerId)
    if (!blocker) continue
    const keywords = cardKeywordIds(blocker.card)
    const firstStrike = strikeKind(blocker.card) !== null
    const deathtouchKill = isDeathtouchKill(prevGame, nextGame, keywords.has('deathtouch'), plan.targetId) && claimSkull(plan.targetId)
    const lifelinkTo = lifelinkGain(prevGame, nextGame, keywords, blocker.controllerId)
    if (!firstStrike && !deathtouchKill && !lifelinkTo) continue
    out.push({ attackerId: plan.attackerId, targetId: plan.targetId, firstStrike, deathtouchKill, lifelinkTo, trampleTo: null, fromBlocker: true })
  }
  return out
}

/** A permanent with indestructible whose damage has reached its toughness: it stays on the battlefield. */
export function survivesLethal(perm: unknown): boolean {
  const p = perm as { toughness?: unknown; damage?: unknown } | null | undefined
  if (!p || !cardKeywordIds(p).has('indestructible')) return false
  const toughness = parseInt(String(p.toughness), 10)
  return toughness > 0 && typeof p.damage === 'number' && p.damage >= toughness
}

function centreOf(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

function strikeRect(id: string): DOMRect | null {
  const el = strikeTargetElement(id)
  return el ? el.getBoundingClientRect() : combatantRect(id)
}

function fire(strike: KeywordStrike): void {
  const targetRect = strikeRect(strike.targetId)
  const attackerRect = strikeRect(strike.attackerId)
  if (strike.firstStrike) spawnImpact('first-strike', targetRect)
  if (strike.deathtouchKill) spawnImpact('deathtouch', targetRect)
  if (strike.lifelinkTo) {
    const to = strikeTargetElement(strike.lifelinkTo)
    if (to) spawnImpact('lifelink', attackerRect, { to: centreOf(to) })
  }
  if (strike.trampleTo) {
    const to = strikeTargetElement(strike.trampleTo)
    if (to) spawnImpact('trample', targetRect, { to: centreOf(to) })
  }
}

/** Schedules the keyword moments of each strike at its landing time and reports when their player-facing results arrive. */
export function playKeywordStrikes(strikes: KeywordStrike[], schedule: StrikeSchedule): KeywordHits {
  const hits: KeywordHits = { playerHits: new Map(), lifeGains: new Map() }
  const hasDom = typeof document !== 'undefined'
  const hitsBy = new Map<string, number>()
  for (const strike of strikes) {
    let at: number | undefined
    if (strike.fromBlocker) {
      at = schedule.impactAt.get(strike.targetId) ?? 0
    } else {
      const n = hitsBy.get(strike.attackerId) ?? 0
      hitsBy.set(strike.attackerId, n + 1)
      at = (n > 0 ? schedule.impactAt.get(strikeHitKey(strike.attackerId, n)) : undefined) ?? schedule.impactAt.get(strike.attackerId)
    }
    if (at === undefined) continue
    if (strike.trampleTo) {
      const ms = at + fxMotionDuration(TRAMPLE_TRAVEL_MS)
      const known = hits.playerHits.get(strike.trampleTo)
      if (known === undefined || ms < known) hits.playerHits.set(strike.trampleTo, ms)
    }
    if (strike.lifelinkTo && (!hasDom || strikeTargetElement(strike.lifelinkTo))) {
      const ms = at + fxMotionDuration(LIFELINK_TRAVEL_MS)
      const known = hits.lifeGains.get(strike.lifelinkTo)
      if (known === undefined || ms > known) hits.lifeGains.set(strike.lifelinkTo, ms)
    }
    if (hasDom) setTimeout(() => fire(strike), at)
  }
  return hits
}
