import type { GameView } from '../net/types'
import { stringList } from '../state/gameUtils'
import { soundManager } from '../audio/soundManager'
import { fxDuration } from './fx'
import { spawnImpact } from './impactFx'
import { getPreviousCardPosition } from './cardPositionRegistry'
import './combatStrikes.css'

export interface StrikePlan {
  attackerId: string
  targetId: string
}

export interface StrikeSchedule {
  holdMs: number
  impactAt: Map<string, number>
}

const STRIKE_MS = 560
const STRIKE_GAP_MS = 240
const IMPACT_AT = 0.5
const MAX_STRIKES = 10

type StrikeKind = 'first' | 'double' | null

export function strikeKind(card: unknown): StrikeKind {
  const c = card as { cardIcons?: Array<{ cardIconType?: string } | null>; rules?: unknown[] } | null | undefined
  const icons = (c?.cardIcons ?? []).map((i) => String(i?.cardIconType ?? ''))
  if (icons.includes('ABILITY_DOUBLE_STRIKE')) return 'double'
  if (icons.includes('ABILITY_FIRST_STRIKE')) return 'first'
  for (const line of c?.rules ?? []) {
    const keywords = String(line).replace(/<[^>]+>/g, '').toLowerCase().split(/[,;.]/).map((s) => s.trim())
    if (keywords.includes('double strike')) return 'double'
    if (keywords.includes('first strike')) return 'first'
  }
  return null
}

function cardOf(game: GameView, group: Record<string, unknown>, id: string): unknown {
  const inGroup = group.attackers && !Array.isArray(group.attackers)
    ? (group.attackers as Record<string, unknown>)[id]
    : undefined
  if (inGroup && typeof inGroup === 'object' && Object.keys(inGroup).length > 0) return inGroup
  for (const p of game.players ?? []) {
    const perm = (p.battlefield ?? {})[id]
    if (perm) return perm
  }
  return inGroup
}

export function combatantIds(game: GameView | null | undefined): string[] {
  const ids = new Set<string>()
  for (const group of game?.combat ?? []) {
    const rec = group as Record<string, unknown>
    stringList(rec.attackers).forEach((id) => ids.add(id))
    stringList(rec.blockers).forEach((id) => ids.add(id))
  }
  return [...ids]
}

const COMBAT_ORDER: Record<string, number> = {
  DECLARE_ATTACKERS: 1,
  DECLARE_BLOCKERS: 2,
  FIRST_COMBAT_DAMAGE: 3,
  COMBAT_DAMAGE: 4,
  END_COMBAT: 5,
  POSTCOMBAT_MAIN: 6,
  END_TURN: 6,
  CLEANUP: 6,
}

function crossedDamage(prevGame: GameView, nextGame: GameView): { first: boolean; regular: boolean } {
  const from = COMBAT_ORDER[String(prevGame.step ?? '')] ?? 0
  const sameTurn = prevGame.turn === nextGame.turn
  const to = sameTurn ? COMBAT_ORDER[String(nextGame.step ?? '')] ?? 0 : 6
  if (from < 1 || from > 3) return { first: false, regular: false }
  return { first: from < 3 && to >= 3, regular: from < 4 && to >= 4 }
}

export function planDamageStrikes(prevGame: GameView, nextGame: GameView): StrikePlan[] {
  const crossed = crossedDamage(prevGame, nextGame)
  if (!crossed.first && !crossed.regular) return []
  const source = (prevGame.combat ?? []).length > 0 ? prevGame : nextGame
  const firstStrikes: StrikePlan[] = []
  const regularStrikes: StrikePlan[] = []
  for (const group of source.combat ?? []) {
    const rec = group as Record<string, unknown>
    const blockers = stringList(rec.blockers)
    const blocked = blockers.length > 0 || rec.isBlocked === true
    const defender = (typeof rec.defenderId === 'string' && rec.defenderId) || stringList(rec.defenders)[0] || null
    const targetId = blockers[0] ?? (blocked ? null : defender)
    if (!targetId) continue
    for (const attackerId of stringList(rec.attackers)) {
      const kind = strikeKind(cardOf(source, rec, attackerId))
      if (crossed.first && kind !== null) firstStrikes.push({ attackerId, targetId })
      else if (crossed.regular && kind !== 'first') regularStrikes.push({ attackerId, targetId })
    }
  }
  return [...firstStrikes, ...regularStrikes]
}

function visibleRect(el: Element | null): DOMRect | null {
  if (!el) return null
  const rect = el.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0 ? rect : null
}

const OFF_BATTLEFIELD = '.graveyard-stack, .exile-stack, .library-stack, .hand-zone, .hand-bar, .stack-zone, .stack-list, .combat-strike-layer'

export function isOffBattlefield(el: Element): boolean {
  return el.closest(OFF_BATTLEFIELD) !== null
}

function slotElement(id: string): HTMLElement | null {
  const els = document.querySelectorAll(`.card-slot[data-card-id="${id}"]`) as NodeListOf<HTMLElement>
  for (const el of els) {
    if (!el.closest(OFF_BATTLEFIELD) && visibleRect(el)) return el
  }
  return null
}

const holds = new Map<string, number>()

export function combatHoldRemaining(id: string | null | undefined): number {
  if (!id) return 0
  const until = holds.get(id)
  if (until === undefined) return 0
  const left = until - Date.now()
  if (left > 0) return left
  holds.delete(id)
  return 0
}

export function strikeTargetElement(id: string): HTMLElement | null {
  const card = slotElement(id)
  if (card) return card
  const anchor = document.querySelector(`[data-player-id="${id}"] [data-player-anchor]`)
  if (visibleRect(anchor)) return anchor as HTMLElement
  const tagged = Array.from(document.querySelectorAll(`[data-player-id="${id}"]`))
  const deepest = tagged.reduce<Element | null>((acc, el) => (!acc || acc.contains(el) ? el : acc), null)
  return visibleRect(deepest) ? (deepest as HTMLElement) : null
}

function shake(el: Element): void {
  el.classList.remove('took-damage')
  void (el as HTMLElement).offsetWidth
  el.classList.add('took-damage')
  setTimeout(() => el.classList.remove('took-damage'), 420)
}

let layer: HTMLDivElement | null = null

function strikeLayer(): HTMLDivElement {
  if (layer && layer.isConnected) return layer
  layer = document.createElement('div')
  layer.className = 'combat-strike-layer'
  layer.setAttribute('aria-hidden', 'true')
  document.body.appendChild(layer)
  return layer
}

function buildGhost(el: HTMLElement, rect: DOMRect): HTMLDivElement {
  const cs = getComputedStyle(el)
  const w = el.offsetWidth || rect.width
  const h = el.offsetHeight || rect.height
  const scale = Math.sqrt((rect.width * rect.height) / Math.max(1, w * h)) || 1

  const clone = el.cloneNode(true) as HTMLElement
  clone.removeAttribute('data-card-id')
  clone.classList.remove('clickable', 'playable', 'targetable', 'is-pending', 'took-damage', 'flight-hidden')
  for (let i = 0; i < cs.length; i++) {
    const prop = cs[i]
    if (prop.startsWith('--')) clone.style.setProperty(prop, cs.getPropertyValue(prop))
  }
  clone.style.width = `${w}px`
  clone.style.height = `${h}px`
  clone.style.margin = '0'
  clone.style.translate = 'none'
  clone.style.transform = cs.transform === 'none' ? '' : cs.transform
  clone.style.animation = 'none'
  clone.style.visibility = 'visible'

  const ghost = document.createElement('div')
  ghost.className = 'combat-strike-ghost'
  ghost.style.width = `${w}px`
  ghost.style.height = `${h}px`
  ghost.style.scale = String(scale)
  placeGhost(ghost, rect)
  ghost.appendChild(clone)
  return ghost
}

function placeGhost(ghost: HTMLDivElement, rect: DOMRect): void {
  const w = parseFloat(ghost.style.width) || rect.width
  const h = parseFloat(ghost.style.height) || rect.height
  ghost.style.left = `${rect.left + rect.width / 2 - w / 2}px`
  ghost.style.top = `${rect.top + rect.height / 2 - h / 2}px`
}

interface Snapshot {
  ghost: HTMLDivElement
  rect: DOMRect
}

const snapshots = new Map<string, Snapshot>()

export function snapshotCombatants(game: GameView | null | undefined): void {
  if (typeof document === 'undefined') return
  const ids = new Set(combatantIds(game))
  for (const id of [...snapshots.keys()]) if (!ids.has(id)) snapshots.delete(id)
  for (const id of ids) {
    const el = slotElement(id)
    if (el) snapshots.set(id, { ghost: buildGhost(el, el.getBoundingClientRect()), rect: el.getBoundingClientRect() })
  }
}

function sequenceMs(count: number, duration: number): number {
  return (Math.min(count, MAX_STRIKES) - 1) * fxDuration(STRIKE_GAP_MS) + duration
}

function holdCombatants(ids: Iterable<string>, ms: number): void {
  const until = Date.now() + ms
  for (const id of ids) holds.set(id, until)
}

export function primeCombatHolds(prevGame: GameView | null | undefined, nextGame: GameView | null | undefined): void {
  if (!prevGame || !nextGame) return
  const plans = planDamageStrikes(prevGame, nextGame)
  const duration = fxDuration(STRIKE_MS)
  if (plans.length === 0 || !duration) return
  snapshotCombatants(prevGame)
  holdCombatants(combatantIds(prevGame), sequenceMs(plans.length, duration))
}

export function clearCombatSnapshots(): void {
  snapshots.clear()
  holds.clear()
}

export function strikeVector(from: DOMRect, to: DOMRect): { dx: number; dy: number } {
  const dx = to.left + to.width / 2 - (from.left + from.width / 2)
  const dy = to.top + to.height / 2 - (from.top + from.height / 2)
  const dist = Math.hypot(dx, dy)
  if (dist < 1) return { dx: 0, dy: 0 }
  const stopShort = Math.min(to.width, to.height) * 0.3 + Math.min(from.width, from.height) * 0.35
  const reach = Math.min(dist * 0.92, Math.max(dist * 0.45, dist - stopShort))
  return { dx: (dx / dist) * reach, dy: (dy / dist) * reach }
}

function impactFeedback(el: Element): void {
  soundManager.play('combat_hit', 'game')
  const card = el.classList.contains('combat-strike-ghost') ? el.firstElementChild ?? el : el
  spawnImpact('sparks', card.getBoundingClientRect())
  shake(card)
}

function runStrike(
  plan: StrikePlan,
  duration: number,
  standIns: Map<string, HTMLDivElement>,
): boolean {
  const live = slotElement(plan.attackerId)
  const standIn = standIns.get(plan.attackerId)
  const targetEl = strikeTargetElement(plan.targetId) ?? standIns.get(plan.targetId) ?? null
  const to = visibleRect(targetEl)
  if ((!live && !standIn) || !targetEl || !to) return false

  const ghost = live ? buildGhost(live, live.getBoundingClientRect()) : standIn!
  if (typeof ghost.animate !== 'function') return false
  const from = ghost.isConnected ? ghost.getBoundingClientRect() : live!.getBoundingClientRect()
  if (!ghost.isConnected) strikeLayer().appendChild(ghost)
  const prevVisibility = live?.style.visibility ?? ''
  if (live) live.style.visibility = 'hidden'

  const { dx, dy } = strikeVector(from, to)
  const back = 0.08
  const anim = ghost.animate(
    [
      { translate: '0px 0px', offset: 0 },
      { translate: `${-dx * back}px ${-dy * back}px`, offset: 0.22, easing: 'cubic-bezier(0.5, 0, 0.9, 0.4)' },
      { translate: `${dx}px ${dy}px`, offset: IMPACT_AT, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
      { translate: `${dx * 0.9}px ${dy * 0.9}px`, offset: IMPACT_AT + 0.08, easing: 'cubic-bezier(0.3, 0, 0.3, 1)' },
      { translate: '0px 0px', offset: 1 },
    ],
    { duration, fill: 'forwards' },
  )

  const impact = setTimeout(() => {
    impactFeedback(strikeTargetElement(plan.targetId) ?? targetEl)
  }, Math.round(duration * IMPACT_AT))

  let done = false
  const finish = () => {
    if (done) return
    done = true
    clearTimeout(impact)
    if (!live) return
    ghost.remove()
    if (live.isConnected) live.style.visibility = prevVisibility
  }
  anim.finished.then(finish, finish)
  setTimeout(finish, duration + 400)
  return true
}

export function playDamageStrikes(plans: StrikePlan[], combatants: string[]): StrikeSchedule {
  const schedule: StrikeSchedule = { holdMs: 0, impactAt: new Map() }
  if (plans.length === 0 || typeof document === 'undefined') return schedule
  const duration = fxDuration(STRIKE_MS)
  if (!duration) {
    new Set(plans.map((p) => p.targetId)).forEach((id) => {
      const el = strikeTargetElement(id)
      if (el) shake(el)
    })
    soundManager.play('combat_hit', 'game')
    return schedule
  }

  const standIns = new Map<string, HTMLDivElement>()
  for (const id of combatants) {
    const snap = snapshots.get(id)
    if (!snap || slotElement(id)) continue
    placeGhost(snap.ghost, getPreviousCardPosition(id) ?? snap.rect)
    strikeLayer().appendChild(snap.ghost)
    standIns.set(id, snap.ghost)
  }

  const gap = fxDuration(STRIKE_GAP_MS)
  const strikes = plans.slice(0, MAX_STRIKES)
  strikes.forEach((plan, i) => {
    const hit = i * gap + Math.round(duration * IMPACT_AT)
    if (!schedule.impactAt.has(plan.targetId)) schedule.impactAt.set(plan.targetId, hit)
    if (!schedule.impactAt.has(plan.attackerId)) schedule.impactAt.set(plan.attackerId, hit)
    setTimeout(() => {
      if (!runStrike(plan, duration, standIns)) {
        const el = strikeTargetElement(plan.targetId) ?? standIns.get(plan.targetId)
        if (el) impactFeedback(el)
        else soundManager.play('combat_hit', 'game')
      }
    }, i * gap)
  })
  schedule.holdMs = sequenceMs(strikes.length, duration)
  holdCombatants(combatants, schedule.holdMs)
  setTimeout(() => standIns.forEach((ghost) => ghost.remove()), schedule.holdMs + 30)
  return schedule
}
