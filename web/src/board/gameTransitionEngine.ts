import { useEffect, useMemo, useRef } from 'react'
import type { CardView, GameView, PlayerView } from '../net/types'
import { startCardFlight, noteFlightEvent, CAST_FLIGHT_MS, ENTER_FLIGHT_MS, ENTER_LAND_AT, type FlightTrail, type FlightVariant } from './flightManager'
import { enqueueStackResolve } from './stackHold'
import { releaseHeldHit } from './damageHold'
import { getPreviousCardPosition, getPreviousCardSize, clearCardPositionRegistry, type CardSourceSize } from './cardPositionRegistry'
import { announceBanner, spawnFloater } from './feedbackFx'
import { t } from '../i18n'
import { isAbilityCard } from '../cards/cardImages'
import { fxDuration, fxMotionAllowed, fxMotionDuration, fxOpacityAllowed } from './fx'
import { cardManaColors, slamBoardWipe, slamLethalPoison, slamSpell, slamUltimate, spawnImpact, spellWeight } from './impactFx'
import { spawnProjectile } from './projectileFx'
import { stackTargetIds } from './stackEntries'
import { clearCombatSnapshots, combatantIds, planDamageStrikes, playDamageStrikes, primeCombatHolds, snapshotCombatants } from './combatStrikes'
import { spawnDamageNumber } from './DamageNumber'
import { planKeywordStrikes, playKeywordStrikes, survivesLethal } from './keywordStrikeFx'
import { restingRect } from './restingRect'
import { observeCoinFlip } from './coinFlipFx'
import { soundManager } from '../audio/soundManager'
import { consumeSacrificed } from './gameLogFx'
import { consumeConceded } from './concedeFx'
import { consumeFizzled, FIZZLE_MS } from './fizzleFx'
import { passedDesignations, spawnDesignationFlight } from './designationFx'
import { primeHandReturns, type HandReturnPile } from './drawSlide'
import { boardWipeDelay, clearBoardWipe, primeBoardWipe, wipeBoardRect } from './boardWipe'
import { CONTROL_FLIGHT_MS, clearControlChanges, controlChanges, controlTintOf, primeControlChanges, type ControlChange } from './controlFx'
import { COMMAND_FLIGHT_MS, castFromCommand, clearCommandReturns, commandReturnSource, commanderReturns, primeCommandReturns, type CommandReturn } from './commandFx'
import { commandZoneCommanders } from './commanders'
import { castCard, departureIds, primeStackEntries, stackDepartures, stackSpellSource, type StackDeparture } from './stackLinks'
import { ANIMATE_FLIGHT_MS, SETTLE_FLIGHT_MS, animateColor, clearCreatureShifts, creatureShifts, primeCreatureShifts, type CreatureShift } from './creatureShiftFx'
import { commandArrivals } from './commandObjectsFx'
import { handReveals, spawnHandReveal } from './handRevealFx'
import { flySpentMana, manaSpends } from './manaSpentFx'

const pendingSlams = new Map<string, CardView>()
const DAMAGE_TEXT = /\bdamage\b/i

function resolvedDamageSpell(prevStack: Record<string, CardView>, nextStack: Record<string, CardView>): boolean {
  for (const [id, spell] of Object.entries(prevStack)) {
    if (id in nextStack) continue
    const rules = [...(spell.rules ?? []), ...(spell.sourceCard?.rules ?? [])]
    if (rules.some((line) => DAMAGE_TEXT.test(String(line)))) return true
  }
  return false
}

export function clearPendingSlams(): void {
  pendingSlams.clear()
}

const PERMANENT_TYPES = ['CREATURE', 'ARTIFACT', 'ENCHANTMENT', 'PLANESWALKER', 'BATTLE', 'LAND']

function isPermanentSpell(spell: CardView): boolean {
  return (spell.cardTypes ?? []).some((t) => PERMANENT_TYPES.includes(String(t).toUpperCase()))
}

function resolvedTo(spellId: string, departures: Map<string, StackDeparture>): 'battlefield' | 'graveyard' | null {
  const zone = departures.get(spellId)?.zone
  return zone === 'battlefield' ? 'battlefield' : zone ? 'graveyard' : null
}

function slamResolvedSpells(nextGame: GameView, departures: Map<string, StackDeparture>): void {
  const nextStack = nextGame.stack ?? {}
  for (const [spellId, spell] of pendingSlams) {
    if (spellId in nextStack) continue
    pendingSlams.delete(spellId)
    const destination = resolvedTo(spellId, departures)
    // Un permanente que entra al campo golpea al tocar el suelo, no al resolverse.
    if (destination === 'battlefield') slamSpell(spell, ENTER_FLIGHT_MS * ENTER_LAND_AT)
    else if (destination === 'graveyard' && !isPermanentSpell(spell)) slamSpell(spell, 320)
  }
}

function rectOf(el: Element | null | undefined): DOMRect | null {
  if (!el) return null
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  return rect
}

function getRect(selector: string): DOMRect | null {
  return rectOf(document.querySelector(selector))
}

const STACK_SELECTOR = '.stack-zone, .stack-deck, .stack-list'
const GRAVE_PILE = ':is(.graveyard-stack, .graveyard-chip)'
const EXILE_PILE = ':is(.exile-stack, .exile-chip)'
const PILE_CARD: CardSourceSize = { w: 44, h: 62 }

/** A card leaving a pile chip (the new table's wide counters) starts as a small upright card, not as a card turned on its side. */
function pileSize(rect: DOMRect | null): CardSourceSize | null {
  return rect && rect.width / rect.height > 1.05 ? PILE_CARD : null
}

/** Resuelve el destino real probando selectores concretos (slot de la carta)
 *  antes de caer al rect del contenedor de zona. Devuelve también el selector
 *  que casó para poder re-medirlo en vuelo. */
function getDestRect(selectors: string[]): { rect: DOMRect; selector: string } | null {
  for (const selector of selectors) {
    const el = document.querySelector(selector) as HTMLElement | null
    const rect = el ? restingRect(el) : null
    if (rect) return { rect, selector }
  }
  return null
}

const pendingTimers = new Set<ReturnType<typeof setTimeout>>()
const pendingFrames = new Set<number>()

function cancelPendingTransitions(): void {
  pendingTimers.forEach((timer) => clearTimeout(timer))
  pendingTimers.clear()
  pendingFrames.forEach((frame) => cancelAnimationFrame(frame))
  pendingFrames.clear()
}

/** Doble rAF: mide cuando React ha asentado el layout (p.ej. el fan de la mano
 *  recalcula overlap en su propio effect). Sin rAF (tests/jsdom), setTimeout. */
function scheduleAfterLayout(fn: () => void): void {
  if (typeof requestAnimationFrame === 'function') {
    const outer = requestAnimationFrame(() => {
      pendingFrames.delete(outer)
      const inner = requestAnimationFrame(() => {
        pendingFrames.delete(inner)
        fn()
      })
      pendingFrames.add(inner)
    })
    pendingFrames.add(outer)
  } else {
    later(34, fn)
  }
}

const STACK_EXIT_MS = 380
const REATTACH_FLIGHT_MS = 520

function attachmentHosts(game: GameView): Map<string, { hostId: string | null; card: CardView }> {
  const hosts = new Map<string, { hostId: string | null; card: CardView }>()
  for (const p of game.players ?? []) {
    for (const [id, perm] of Object.entries(p.battlefield ?? {})) hosts.set(id, { hostId: null, card: perm })
  }
  for (const p of game.players ?? []) {
    for (const [id, perm] of Object.entries(p.battlefield ?? {})) {
      for (const attId of perm.attachments ?? []) {
        const entry = hosts.get(attId)
        if (entry) entry.hostId = id
      }
    }
  }
  return hosts
}

/** An aura or equipment that stays on the battlefield but changes host (equip, re-enchant, unattach) flies to its new slot. */
function flyReattached(prevGame: GameView, nextGame: GameView): void {
  if (!fxMotionAllowed()) return
  const before = attachmentHosts(prevGame)
  for (const [attId, now] of attachmentHosts(nextGame)) {
    const was = before.get(attId)
    if (!was || was.hostId === now.hostId) continue
    const from = getPreviousCardPosition(attId)
    if (!from) continue
    flyAfterLayout(attId, now.card, from, [`[data-card-id="${attId}"]`], null, REATTACH_FLIGHT_MS, getPreviousCardSize(attId), undefined, 'gold')
  }
}

/** A spell leaving the stack for its graveyard/exile flies there (to the card it became); otherwise it flashes in place. */
function playStackSpellExit(spellId: string, spell: CardView, prevRect: DOMRect, prevSize: CardSourceSize | null, players: PlayerView[], departure: StackDeparture | undefined) {
  let destSelectors: string[] = []
  let fallbackRect: DOMRect | null = null
  const owner = departure && departure.zone !== 'battlefield' ? players.find((p) => p.playerId === departure.playerId) : undefined
  const ps = owner ? getPlayerSelector(owner.playerId, owner.name) : ''
  if (departure && ps) {
    const pile = departure.zone === 'graveyard' ? GRAVE_PILE : EXILE_PILE
    destSelectors = [`${ps} ${pile} [data-card-id="${departure.cardId}"]`, `${ps} ${pile}`]
    fallbackRect = getRect(`${ps} ${pile}`)
  }

  if (destSelectors.length > 0) {
    flyAfterLayout(spellId, spell, prevRect, destSelectors, fallbackRect, STACK_EXIT_MS, prevSize)
  } else {
    startCardFlight(spell, prevRect, prevRect, 340, undefined, { static: true, sourceSize: prevSize })
  }
}

function getPlayerSelector(playerId?: string, playerName?: string): string {
  if (playerId && playerName) {
    return `:is([data-player-id="${playerId}"], [data-player-name="${playerName}"])`
  }
  if (playerId) return `[data-player-id="${playerId}"]`
  if (playerName) return `[data-player-name="${playerName}"]`
  return ''
}

/** Vuelo diferido tras asentar el layout. Si el camino A (montaje del slot)
 *  u otro vuelo ya cubre esta carta, `startCardFlight` encadena o ignora
 *  (mismo destino) sin duplicar fantasmas. */
function flyAfterLayout(
  cardId: string,
  card: CardView,
  fromRect: DOMRect | null,
  destSelectors: string[],
  fallbackRect: DOMRect | null,
  duration: number,
  sourceSize?: CardSourceSize | null,
  variant?: FlightVariant,
  trail?: FlightTrail,
  lift?: boolean,
  reveal?: boolean,
  conceal?: boolean
): void {
  if (!fromRect) {
    noteFlightEvent({ kind: 'skip', reason: 'no-source', cardId, detail: `engine:${card.name ?? ''}` })
    return
  }
  scheduleAfterLayout(() => {
    const dest = getDestRect(destSelectors)
    const toRect = dest?.rect ?? fallbackRect
    if (!toRect) {
      noteFlightEvent({ kind: 'skip', reason: 'no-dest', cardId, detail: `engine:${card.name ?? ''}:${destSelectors[0] ?? '?'}` })
      return
    }
    startCardFlight(card, fromRect, toRect, duration, dest?.selector, { sourceSize, variant, trail, lift, reveal, conceal })
  })
}

function replayClass(el: Element, cls: string, ms: number): void {
  el.classList.remove(cls)
  void (el as HTMLElement).offsetWidth
  el.classList.add(cls)
  setTimeout(() => el.classList.remove(cls), ms)
}

function shakeElement(selector: string, ms = 420): void {
  const el = document.querySelector(selector)
  if (el) replayClass(el, 'took-damage', ms)
}

const COUNTERED_MS = 520
const HAND_RETURN_MS = 420
const EXILE_ARRIVAL_MS = 460
const PT_POP_MS = 700
const PT_FLOAT_GAP = 14
const TRANSFORM_FLIP_MS = 700
const BOUNCE_FLIGHT_MS = 420

/**
 * Spells countered in this update: each left the stack for a graveyard or exile (not the
 * battlefield) together with another stack object that targeted it, the counterspell.
 */
export function counteredSpellIds(prevGame: GameView, nextGame: GameView, departures = stackDepartures(prevGame, nextGame)): Set<string> {
  const prevStack = prevGame.stack ?? {}
  const nextStack = nextGame.stack ?? {}
  const departed = Object.keys(prevStack).filter((id) => !(id in nextStack))
  const countered = new Set<string>()
  for (const id of departed) {
    if (resolvedTo(id, departures) !== 'graveyard') continue
    if (departed.some((other) => other !== id && stackTargetIds(prevStack[other]).includes(id))) countered.add(id)
  }
  return countered
}

/** A permanent that stayed on the battlefield but changed face (transform, day/night, disturb back). */
function flipTransformed(permId: string): void {
  if (!fxMotionAllowed()) return
  scheduleAfterLayout(() => {
    const slots = [...document.querySelectorAll(`.card-slot[data-card-id="${permId}"]`)].filter((el) => !el.closest(STACK_SELECTOR))
    const ms = fxMotionDuration(TRANSFORM_FLIP_MS)
    for (const slot of slots) replayClass(slot, 'fx-transform-flip', ms + 40)
    const rect = rectOf(slots[0])
    if (rect) later(Math.round(ms * 0.4), () => spawnImpact('transform', rect))
  })
}

const FACE_UP_MS = 900

/** A face-down permanent turned face up: it turns edge-on in a dark shroud and comes round lit in its own colours. */
function revealFaceUp(permId: string, card: CardView): void {
  if (!fxMotionAllowed()) return
  scheduleAfterLayout(() => {
    const slots = battlefieldSlots(permId)
    for (const slot of slots) replayClass(slot, 'fx-face-up', fxMotionDuration(FACE_UP_MS) + 40)
    const rect = rectOf(slots[0])
    if (rect) spawnImpact('face-up', rect, { colors: cardManaColors(card) })
  })
}

function counterTone(kind: string): 'poison' | 'energy' | 'mixed' {
  return kind === 'poison' ? 'poison' : kind === 'energy' ? 'energy' : 'mixed'
}

/**
 * A player counter changed: its badge on the info bar already pulses and ticks; the change floats up
 * from it, poison drips toxic green (and, reaching ten, a cloud bursts over the seat) and energy cracks
 * as a yellow bolt.
 */
function animatePlayerCounter(playerId: string, change: PlayerCounterChange): void {
  if (!fxOpacityAllowed()) return
  scheduleAfterLayout(() => {
    const bar = `.player-info-bar[data-player-id="${playerId}"]`
    const kind = change.name.toLowerCase()
    const barRect = getRect(bar)
    const anchor = getRect(`${bar} [data-counter="${kind}"]`) ?? barRect
    if (!anchor) return
    const delta = change.to - change.from
    spawnFloater(`counter:${playerId}:${kind}`, new DOMRect(anchor.left, anchor.top - PT_FLOAT_GAP, anchor.width, 1), signed(delta), counterTone(kind), true)
    if (kind === 'poison' && delta > 0) {
      if (change.to >= POISON_LETHAL && change.from < POISON_LETHAL) slamLethalPoison(barRect ?? anchor)
      spawnImpact('poison', anchor)
    } else if (kind === 'energy') {
      spawnImpact('energy', anchor)
    }
  })
}

/**
 * A permanent changed controller: a tether in its new controller's seat colour seizes it where it
 * stood and reels it into its new slot. The slot mounting there flies the card itself when it can
 * (its zone changed); this flight covers a move between two opponents' zones.
 */
function pullControlled(change: ControlChange, nextGame: GameView, wasTapped: boolean): void {
  const owner = (nextGame.players ?? []).find((p) => p.playerId === change.to)
  const perm = owner?.battlefield?.[change.id]
  if (!owner || !perm) return
  const from = getPreviousCardPosition(change.id)
  if (!from) {
    noteFlightEvent({ kind: 'skip', reason: 'no-source', cardId: change.id, detail: `control:${perm.name ?? ''}` })
    return
  }
  const sourceSize = wasTapped ? null : getPreviousCardSize(change.id)
  const pSel = getPlayerSelector(owner.playerId, owner.name)
  const tint = controlTintOf(nextGame, change)
  scheduleAfterLayout(() => {
    const dest = getDestRect([`${pSel} .card-slot[data-card-id="${change.id}"]`, `[data-card-id="${change.id}"]`, `${pSel} .creatures-band`, `${pSel} .permanents-band`])
    if (!dest) {
      noteFlightEvent({ kind: 'skip', reason: 'no-dest', cardId: change.id, detail: `control:${perm.name ?? ''}` })
      return
    }
    const to = { x: dest.rect.left + dest.rect.width / 2, y: dest.rect.top + dest.rect.height / 2 }
    spawnImpact('control', from, { to, tint })
    startCardFlight(perm, from, dest.rect, CONTROL_FLIGHT_MS, dest.selector, { sourceSize, variant: 'control', tint })
  })
}

const ANIMATE_GLOW_MS = 900
const FLIP_CARD_MS = 700
const EMBLEM_POP_MS = 750
const PLANE_ROLL_MS = 950
const DUNGEON_PULSE_MS = 900

/**
 * A permanent started being a creature (an animated land, a crewed vehicle): a column of light in its
 * colour lifts it where it stood, its slot flies itself into the creature band, and it lands lit. One
 * that stops being a creature (the effect wearing off) settles back, dimming for a moment.
 */
function shiftCreature(shift: CreatureShift, card: CardView): void {
  if (!fxOpacityAllowed()) return
  const color = animateColor(card)
  const tone = color ? `var(--mana-${color}-rgb)` : 'var(--gold-rgb)'
  const flies = fxMotionAllowed()
  const from = getPreviousCardPosition(shift.id)
  if (shift.rises && from) spawnImpact('animate', from, { colors: color ? [color] : [] })
  later(flies ? fxDuration(shift.rises ? ANIMATE_FLIGHT_MS : SETTLE_FLIGHT_MS) : 0, () => scheduleAfterLayout(() => {
    const slot = battlefieldSlots(shift.id)[0] as HTMLElement | undefined
    if (!slot) return
    slot.style.setProperty('--animate-rgb', tone)
    if (shift.rises && !from) spawnImpact('animate', rectOf(slot), { colors: color ? [color] : [] })
    replayClass(slot, shift.rises ? 'fx-animate-rise' : 'fx-animate-settle', fxDuration(shift.rises ? ANIMATE_GLOW_MS : 600) + 40)
  }))
}

/** A Kamigawa flip card turned over (or back): it lifts, turns a half circle with a flash and settles. */
function turnFlipCard(permId: string, flipped: boolean, card: CardView): void {
  if (!fxMotionAllowed()) return
  scheduleAfterLayout(() => {
    const slots = battlefieldSlots(permId)
    const ms = fxMotionDuration(FLIP_CARD_MS)
    const rect = rectOf(slots[0])
    for (const slot of slots) replayClass(slot, flipped ? 'fx-flip-card' : 'fx-unflip-card', ms + 40)
    if (rect) spawnImpact('flip', rect, { colors: cardManaColors(card) })
  })
}

/** Command-zone slot of an emblem or a plane, measured once the update has rendered. */
function commandSlot(id: string, playerId?: string): HTMLElement | null {
  const scope = playerId ? `[data-player-id="${playerId}"] ` : ''
  return document.querySelector<HTMLElement>(`${scope}.command-zone [data-card-id="${id}"]`) ?? document.querySelector<HTMLElement>(`.command-zone [data-card-id="${id}"]`)
}

/** Emblems pop into the command zone, a new plane rolls in out of a planar portal, and a dungeon badge lights up as a room is entered. */
function animateCommandArrivals(prevGame: GameView, nextGame: GameView): void {
  if (!fxOpacityAllowed()) return
  const arrivals = commandArrivals(prevGame, nextGame)
  if (arrivals.emblems.length + arrivals.planes.length + arrivals.dungeons.length === 0) return
  scheduleAfterLayout(() => {
    for (const emblem of arrivals.emblems) {
      const slot = commandSlot(emblem.id, emblem.playerId)
      spawnImpact('emblem', rectOf(slot) ?? getRect(`.player-info-bar[data-player-id="${emblem.playerId}"]`))
      if (slot) replayClass(slot, 'fx-emblem-pop', fxDuration(EMBLEM_POP_MS) + 40)
    }
    for (const plane of arrivals.planes) {
      const slot = commandSlot(plane.id)
      if (!slot) continue
      spawnImpact('planeswalk', rectOf(slot))
      replayClass(slot, 'fx-plane-roll', fxDuration(PLANE_ROLL_MS) + 40)
      if (plane.replaced) soundManager.play('impact_heavy', 'game')
    }
    for (const { playerId, dungeon, entered } of arrivals.dungeons) {
      const badge = document.querySelector(`.player-info-bar[data-player-id="${playerId}"] .badge-dungeon`)
      const rect = rectOf(badge) ?? getRect(`.player-info-bar[data-player-id="${playerId}"]`)
      if (badge) replayClass(badge, 'fx-dungeon-advance', fxDuration(DUNGEON_PULSE_MS) + 40)
      spawnImpact('dungeon', rect)
      const label = entered ? dungeon.name : dungeon.room
      if (label && rect) spawnFloater(`dungeon:${playerId}`, new DOMRect(rect.left, rect.top - PT_FLOAT_GAP, rect.width, 1), label, 'mixed', true)
    }
  })
}

/** An opponent's hand was revealed to me (or grew while revealed): it fans out face up beside it, card by card. */
function fanRevealedHands(prevGame: GameView, nextGame: GameView): void {
  if (!fxMotionAllowed()) return
  const reveals = handReveals(prevGame, nextGame)
  if (reveals.length === 0) return
  scheduleAfterLayout(() => {
    for (const reveal of reveals) {
      const player = (nextGame.players ?? []).find((p) => p.playerId === reveal.playerId)
      const pSel = player ? getPlayerSelector(player.playerId, player.name) : ''
      const bar = `.player-info-bar[data-player-id="${reveal.playerId}"]`
      const anchor = (pSel ? getRect(`${pSel} .hand-zone`) : null) ?? getRect(`${bar} .pp-hand-badge`) ?? getRect(bar)
      spawnHandReveal(reveal.playerId, reveal.cards, anchor)
    }
  })
}

const TUCK_FLIGHT_MS = 460
const MUTATE_FLIGHT_MS = 560
const ATTACH_GLOW_MS = 900
const MUTATE_MERGE_MS = 800

/**
 * A commander went back to its command zone: a column of gold light and a crown lift off where it
 * was, it flies into its command-zone slot (the slot mounting there flies it itself when it can) and
 * a gold ring spreads as it lands.
 */
function sendToCommand(ret: CommandReturn, nextGame: GameView, fallbackFrom: DOMRect | null): void {
  const owner = (nextGame.players ?? []).find((p) => p.playerId === ret.playerId)
  if (!owner) return
  const pSel = getPlayerSelector(owner.playerId, owner.name)
  const primedFrom = commandReturnSource(ret.id)
  const from = primedFrom?.rect ?? getPreviousCardPosition(ret.id) ?? fallbackFrom
  if (!from) {
    noteFlightEvent({ kind: 'skip', reason: 'no-source', cardId: ret.id, detail: `command:${ret.card.name ?? ''}` })
    return
  }
  const size = primedFrom ? primedFrom.size : getPreviousCardSize(ret.id)
  const slot = `${pSel} .command-zone [data-card-id="${ret.id}"]`
  spawnImpact('command', from)
  flyAfterLayout(ret.id, ret.card, from, [slot, `${pSel} .command-zone`, `.player-info-bar[data-player-id="${owner.playerId}"]`], null, COMMAND_FLIGHT_MS, size, 'command')
  later(fxDuration(COMMAND_FLIGHT_MS) + 40, () => spawnImpact('enter-ring', getRect(slot) ?? getRect(`${pSel} .command-zone`)))
}

/** A card put into a library flies to that library pile and turns face down on the way (it is already face down when it leaves an opponent's hand). */
function tuckToLibrary(id: string, card: CardView, from: DOMRect | null, size: CardSourceSize | null, libSel: string, libRect: DOMRect | null, vortex: boolean): void {
  if (!from) {
    noteFlightEvent({ kind: 'skip', reason: 'no-source', cardId: id, detail: `tuck:${card.name ?? ''}` })
    return
  }
  if (vortex) spawnImpact('tuck', from)
  flyAfterLayout(id, card, from, [libSel], libRect, TUCK_FLIGHT_MS, size, 'tuck', undefined, undefined, undefined, true)
}

/** An aura (or bestow) just landed on its host: a thread of light in the aura's colour binds them and the host glows. */
function linkAura(auraId: string, hostId: string, aura: CardView): void {
  if (!fxOpacityAllowed()) return
  scheduleAfterLayout(() => {
    const hostSlot = battlefieldSlots(hostId).find((el) => !el.classList.contains('mutate-part')) as HTMLElement | undefined
    const hostRect = rectOf(hostSlot)
    if (!hostSlot || !hostRect) return
    const auraSlot = battlefieldSlots(auraId)[0] as HTMLElement | undefined
    const auraRect = rectOf(auraSlot)
    const colors = cardManaColors(aura)
    const tone = colors[0] ? `var(--mana-${colors[0]}-rgb)` : 'var(--gold-rgb)'
    spawnImpact('attach', hostRect, { colors, to: auraRect ? { x: auraRect.left + auraRect.width / 2, y: auraRect.top + auraRect.height / 2 } : null })
    for (const slot of [hostSlot, auraSlot]) {
      if (!slot) continue
      slot.style.setProperty('--attach-rgb', tone)
      replayClass(slot, 'fx-attach-glow', fxDuration(ATTACH_GLOW_MS) + 40)
    }
  })
}

/** A mutating spell drops from the stack onto its host, which ripples and swells as they merge. */
function mergeIntoHost(spellId: string, spell: CardView, fromRect: DOMRect, fromSize: CardSourceSize | null, hostId: string): void {
  scheduleAfterLayout(() => {
    const dest = getDestRect([`.card-slot[data-card-id="${hostId}"]:not(.mutate-part)`])
    if (dest) startCardFlight(spell, fromRect, dest.rect, MUTATE_FLIGHT_MS, dest.selector, { sourceSize: fromSize, variant: 'mutate' })
    else noteFlightEvent({ kind: 'skip', reason: 'no-dest', cardId: spellId, detail: `mutate:${spell.name ?? ''}` })
    later(dest ? fxDuration(MUTATE_FLIGHT_MS) : 0, () => {
      const slot = battlefieldSlots(hostId).find((el) => !el.classList.contains('mutate-part'))
      const rect = rectOf(slot) ?? dest?.rect ?? null
      spawnImpact('mutate', rect, { colors: cardManaColors(spell) })
      if (slot) replayClass(slot, 'fx-mutate-merge', fxMotionDuration(MUTATE_MERGE_MS) + 40)
      if (rect) soundManager.play('card_land', 'game')
    })
  })
}

/** The P/T box pops green (pump), red (shrink) or gold (both ways) and the difference floats up from it. */
function pulsePt(change: PtChange): void {
  if (!fxOpacityAllowed()) return
  scheduleAfterLayout(() => {
    const slot = battlefieldSlots(change.id)[0]
    if (!slot) return
    const badge = slot.querySelector('.pt-badge')
    const tone = change.power >= 0 && change.toughness >= 0 ? 'good' : change.power <= 0 && change.toughness <= 0 ? 'bad' : 'mixed'
    if (badge) replayClass(badge, `fx-pt-${tone === 'good' ? 'pump' : tone === 'bad' ? 'shrink' : 'mixed'}`, fxDuration(PT_POP_MS) + 40)
    const anchor = rectOf(badge) ?? rectOf(slot)
    const above = anchor ? new DOMRect(anchor.left, anchor.top - PT_FLOAT_GAP, anchor.width, 1) : null
    spawnFloater(`pt:${change.id}`, above, ptChangeLabel(change), tone, true)
  })
}

/**
 * Permanents an opponent's battlefield lost to their hand: the server only sends that hand's
 * count, so a non-token that went nowhere visible while the count grew is read as bounced
 * (at most as many as the count grew).
 */
export function opponentBounceIds(prevP: PlayerView, nextP: PlayerView, nextGame: GameView): string[] {
  const grown = (nextP.handCount ?? 0) - (prevP.handCount ?? 0)
  if (nextP.controlled === true || grown <= 0) return []
  const onField = new Set((nextGame.players ?? []).flatMap((p) => [...Object.keys(p.battlefield ?? {}), ...commandZoneCommanders(p).keys()]))
  const myHand = nextGame.myHand ?? {}
  return Object.entries(prevP.battlefield ?? {})
    .filter(([id, perm]) => !onField.has(id) && !(id in (nextP.graveyard ?? {})) && !(id in (nextP.exile ?? {}))
      && !(id in myHand) && (perm as { isToken?: boolean }).isToken !== true)
    .map(([id]) => id)
    .slice(0, grown)
}

function hasType(card: CardView | undefined, type: string): boolean {
  return (card?.cardTypes ?? []).some((t) => String(t).toUpperCase() === type)
}

function ptNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const PT_COUNTER = /^([+-]\d+)\/([+-]\d+)$/

/** What a permanent's counters add to its power and toughness (+1/+1, -1/-1, +1/+0, …). */
function counterPt(card: CardView): { power: number; toughness: number } {
  let power = 0
  let toughness = 0
  for (const counter of card.counters ?? []) {
    const match = PT_COUNTER.exec(String(counter.name ?? '').trim())
    if (!match) continue
    power += Number(match[1]) * (counter.count ?? 0)
    toughness += Number(match[2]) * (counter.count ?? 0)
  }
  return { power, toughness }
}

export interface PtChange {
  id: string
  power: number
  toughness: number
}

/**
 * Creatures that stayed on `nextP`'s battlefield with another power or toughness, net of what
 * their P/T counters changed in the same update (the counter badge already pulses for that). A
 * permanent that changed face or name (transform, turned face up, copy) is not a pump.
 */
export function ptChanges(prevP: PlayerView, nextP: PlayerView): PtChange[] {
  const prevBattlefield = prevP.battlefield ?? {}
  const out: PtChange[] = []
  for (const [id, next] of Object.entries(nextP.battlefield ?? {})) {
    const prev = prevBattlefield[id]
    if (!prev || !hasType(prev, 'CREATURE') || !hasType(next, 'CREATURE')) continue
    if ((prev.transformed === true) !== (next.transformed === true) || (prev.faceDown === true) !== (next.faceDown === true) || prev.name !== next.name) continue
    const prevPower = ptNumber(prev.power)
    const prevToughness = ptNumber(prev.toughness)
    const nextPower = ptNumber(next.power)
    const nextToughness = ptNumber(next.toughness)
    if (prevPower === null || prevToughness === null || nextPower === null || nextToughness === null) continue
    const before = counterPt(prev)
    const after = counterPt(next)
    const power = nextPower - prevPower - (after.power - before.power)
    const toughness = nextToughness - prevToughness - (after.toughness - before.toughness)
    if (power !== 0 || toughness !== 0) out.push({ id, power, toughness })
  }
  return out
}

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)

export function ptChangeLabel(change: PtChange): string {
  return `${signed(change.power)}/${signed(change.toughness)}`
}

function pilesOf(player: PlayerView | undefined): Array<[HandReturnPile, Record<string, CardView>]> {
  return [['graveyard', player?.graveyard ?? {}], ['exile', player?.exile ?? {}]]
}

/** Cards of my new hand that were in my graveyard or exile in the previous view (Regrowth, Eternal Witness). */
export function myHandReturns(prevGame: GameView | null | undefined, nextGame: GameView | null | undefined): Map<string, HandReturnPile> {
  const returns = new Map<string, HandReturnPile>()
  if (!prevGame || !nextGame) return returns
  const me = (prevGame.players ?? []).find((p) => p.controlled === true)
  if (!me) return returns
  const prevHand = prevGame.myHand ?? {}
  for (const id of Object.keys(nextGame.myHand ?? {})) {
    if (id in prevHand) continue
    const pile = pilesOf(me).find(([, cards]) => id in cards)?.[0]
    if (pile) returns.set(id, pile)
  }
  return returns
}

function visibleIds(game: GameView): Set<string> {
  const ids = new Set([...Object.keys(game.stack ?? {}), ...Object.keys(game.myHand ?? {})])
  for (const p of game.players ?? []) {
    for (const zone of [p.battlefield, p.graveyard, p.exile]) for (const id of Object.keys(zone ?? {})) ids.add(id)
    for (const id of commandZoneCommanders(p).keys()) ids.add(id)
  }
  return ids
}

export interface LibraryTucks {
  /** Permanents of the player's battlefield put into their library (Chaos Warp, a tuck). */
  permanents: string[]
  /** Cards of my hand put into my library (Brainstorm, Scroll Rack). */
  hand: string[]
  /** Cards an opponent put from their hand into their library: the server only sends both counts. */
  hidden: number
}

const NO_TUCKS: LibraryTucks = { permanents: [], hand: [], hidden: 0 }

function controlledBy(card: CardView, player: PlayerView): boolean {
  const ctrlId = card.controllerId ?? card.sourceCard?.controllerId
  const ctrlName = card.controllerName ?? card.sourceCard?.controllerName
  return ctrlId ? ctrlId === player.playerId : ctrlName === player.name
}

/**
 * Cards `nextP` put into their library in this update: their library grew while cards left their
 * battlefield or my hand for no visible zone (at most as many as it grew). An opponent's hand only
 * has a count, so a shrinking hand counts when nothing of theirs reached a graveyard, an exile, the
 * stack or a battlefield. The mulligan (views with no phase) has an animation of its own.
 */
export function libraryTucks(prevP: PlayerView, nextP: PlayerView, prevGame: GameView, nextGame: GameView): LibraryTucks {
  if (nextGame.phase == null) return NO_TUCKS
  let room = (nextP.libraryCount ?? 0) - (prevP.libraryCount ?? 0)
  if (room <= 0) return NO_TUCKS
  const visible = visibleIds(nextGame)
  const bounced = new Set(opponentBounceIds(prevP, nextP, nextGame))
  const permanents = Object.entries(prevP.battlefield ?? {})
    .filter(([id, perm]) => !visible.has(id) && !bounced.has(id) && (perm as { isToken?: boolean }).isToken !== true)
    .map(([id]) => id)
    .slice(0, room)
  room -= permanents.length
  if (nextP.controlled === true) {
    const hand = Object.keys(prevGame.myHand ?? {}).filter((id) => !visible.has(id)).slice(0, Math.max(0, room))
    return { permanents, hand, hidden: 0 }
  }
  const shrank = (prevP.handCount ?? 0) - (nextP.handCount ?? 0)
  if (shrank <= 0 || room <= 0) return { permanents, hand: [], hidden: 0 }
  const before = visibleIds(prevGame)
  const prevStack = prevGame.stack ?? {}
  const arrived = [nextP.graveyard, nextP.exile, nextP.battlefield].some((zone) => Object.keys(zone ?? {}).some((id) => !before.has(id)))
  const cast = Object.entries(nextGame.stack ?? {}).some(([id, s]) => !(id in prevStack) && !isAbilityCard(s) && s.isAbility !== true && controlledBy(s, nextP))
  return { permanents, hand: [], hidden: arrived || cast ? 0 : Math.min(shrank, room) }
}

/** New permanents of `nextP` that entered attached to a permanent still on a battlefield (an Aura resolving, a bestow). */
export function auraAttachments(prevP: PlayerView, nextP: PlayerView, nextGame: GameView): Array<{ id: string; hostId: string }> {
  const prevBattlefield = prevP.battlefield ?? {}
  const onField = new Set((nextGame.players ?? []).flatMap((p) => Object.keys(p.battlefield ?? {})))
  const out: Array<{ id: string; hostId: string }> = []
  for (const [id, perm] of Object.entries(nextP.battlefield ?? {})) {
    const hostId = perm.attachedTo
    if (id in prevBattlefield || !hostId || hostId === id || !onField.has(hostId)) continue
    out.push({ id, hostId })
  }
  return out
}

/**
 * Mutating spells that merged onto their host in this update, as spell id → host id: the spell left
 * the stack without entering as a permanent of its own while a host that stayed on the battlefield is
 * mutated and its `mutateView` gained that card (same id, or the same name, since a spell on the stack
 * has an id of its own).
 */
export function mutateMerges(prevGame: GameView, nextGame: GameView): Map<string, string> {
  const prevStack = prevGame.stack ?? {}
  const nextStack = nextGame.stack ?? {}
  const prevPerms = new Map((prevGame.players ?? []).flatMap((p) => Object.entries(p.battlefield ?? {})))
  const departed = Object.entries(prevStack).filter(([id, s]) => !(id in nextStack) && s.isAbility !== true && !isAbilityCard(s))
  const merges = new Map<string, string>()
  for (const p of nextGame.players ?? []) {
    for (const [hostId, perm] of Object.entries(p.battlefield ?? {})) {
      const before = prevPerms.get(hostId)
      if (!before || perm.mutated !== true) continue
      const had = before.mutateView?.cards ?? {}
      for (const [cardId, card] of Object.entries(perm.mutateView?.cards ?? {})) {
        if (cardId === hostId || cardId in had || !card) continue
        const spell = departed.find(([id, s]) => !merges.has(id) && (id === cardId || s.sourceCard?.id === cardId))
          ?? departed.find(([id, s]) => !merges.has(id) && s.name === card.name)
        if (spell) merges.set(spell[0], hostId)
      }
    }
  }
  return merges
}

/**
 * Cards an opponent took back to their hand from their graveyard or exile: the server only sends
 * that hand's count, so a card that left the pile for no visible zone while the count grew (net of
 * bounces) is read as returned, at most as many as the count grew.
 */
export function opponentHandReturns(prevP: PlayerView, nextP: PlayerView, nextGame: GameView): Array<{ id: string; pile: HandReturnPile; card: CardView }> {
  if (nextP.controlled === true) return []
  const grown = (nextP.handCount ?? 0) - (prevP.handCount ?? 0) - opponentBounceIds(prevP, nextP, nextGame).length
  if (grown <= 0) return []
  const visible = visibleIds(nextGame)
  const out: Array<{ id: string; pile: HandReturnPile; card: CardView }> = []
  for (const [pile, cards] of pilesOf(prevP)) {
    for (const [id, card] of Object.entries(cards)) if (!visible.has(id)) out.push({ id, pile, card })
  }
  return out.slice(0, grown)
}

export type ExileOrigin = 'hand' | 'graveyard' | 'library'

/**
 * Cards new to `nextP`'s exile that were neither on the battlefield nor on the stack (delve,
 * escape, cascade, impulse draw, Rest in Peace), with the zone each left: the graveyard when it was
 * there, the hand when it was in my hand (or, for an opponent, when their hand shrank), else the library.
 */
export function exileArrivals(prevP: PlayerView, nextP: PlayerView, prevGame: GameView, fromStack: ReadonlySet<string> = new Set()): Array<{ id: string; origin: ExileOrigin }> {
  const prevExile = prevP.exile ?? {}
  const prevStack = prevGame.stack ?? {}
  const onBattlefield = new Set((prevGame.players ?? []).flatMap((p) => Object.keys(p.battlefield ?? {})))
  const handShrank = (nextP.handCount ?? 0) < (prevP.handCount ?? 0)
  return Object.keys(nextP.exile ?? {})
    .filter((id) => !(id in prevExile) && !(id in prevStack) && !fromStack.has(id) && !onBattlefield.has(id))
    .map((id) => {
      if (id in (prevP.graveyard ?? {})) return { id, origin: 'graveyard' as const }
      const fromHand = nextP.controlled === true ? id in (prevGame.myHand ?? {}) : handShrank
      return { id, origin: fromHand ? 'hand' as const : 'library' as const }
    })
}

/**
 * The pile a new stack spell was cast from (flashback, escape, foretell, adventure, plot): its card was
 * in its controller's graveyard or exile (by id, or by name when `nextGame` shows it left that pile).
 */
export function castFromPile(spell: CardView, spellId: string, prevGame: GameView, nextGame?: GameView | null): HandReturnPile | null {
  const zone = castCard(spellId, spell, prevGame, nextGame)?.zone
  return zone === 'graveyard' || zone === 'exile' ? zone : null
}

export type FaceDownKind = 'morph' | 'manifest' | 'disguise' | 'cloak' | 'face-down'

/**
 * Face-down permanents of `nextP` that were turned face up (morph, manifest, disguise, cloak): the
 * same id stays on the battlefield and `faceDown` turns false. The kind comes from the face-down
 * view's flags, which the face-up view clears.
 */
export function turnedFaceUp(prevP: PlayerView, nextP: PlayerView): Array<{ id: string; kind: FaceDownKind }> {
  const prevBattlefield = prevP.battlefield ?? {}
  const out: Array<{ id: string; kind: FaceDownKind }> = []
  for (const [id, next] of Object.entries(nextP.battlefield ?? {})) {
    const prev = prevBattlefield[id]
    if (!prev || prev.faceDown !== true || next.faceDown === true) continue
    const kind: FaceDownKind = prev.morphed ? 'morph' : prev.manifested ? 'manifest' : prev.disguised ? 'disguise' : prev.cloaked ? 'cloak' : 'face-down'
    out.push({ id, kind })
  }
  return out
}

/** Permanents of `nextP` that stayed and were flipped or unflipped (Kamigawa flip cards: `flipped` toggles). */
export function flippedChanges(prevP: PlayerView, nextP: PlayerView): string[] {
  const before = prevP.battlefield ?? {}
  return Object.entries(nextP.battlefield ?? {})
    .filter(([id, next]) => id in before && (before[id].flipped === true) !== (next.flipped === true))
    .map(([id]) => id)
}

export interface PlayerCounterChange {
  name: string
  from: number
  to: number
}

/** Poison counters that kill. */
export const POISON_LETHAL = 10

/** Player counters (poison, energy, experience, rad, tickets, speed…) whose count changed, a missing one counting as 0. */
export function playerCounterChanges(prevP: PlayerView, nextP: PlayerView): PlayerCounterChange[] {
  const counts = (p: PlayerView) => new Map((p.counters ?? []).map((c) => [String(c.name ?? ''), c.count ?? 0] as const))
  const before = counts(prevP)
  const after = counts(nextP)
  const out: PlayerCounterChange[] = []
  for (const name of new Set([...before.keys(), ...after.keys()])) {
    if (!name) continue
    const from = before.get(name) ?? 0
    const to = after.get(name) ?? 0
    if (from !== to) out.push({ name, from, to })
  }
  return out
}

function later(ms: number, fn: () => void): void {
  if (ms > 0) {
    const timer = setTimeout(() => {
      pendingTimers.delete(timer)
      fn()
    }, ms)
    pendingTimers.add(timer)
  } else fn()
}

const PHASE_OUT_MS = 600
const COPY_FLIGHT_MS = 520
const MULLIGAN_RETURN_MS = 300
const MULLIGAN_DEAL_MS = 320
const MULLIGAN_STAGGER_MS = 55
const MULLIGAN_MAX_CARDS = 8
/** A loyalty cost at least this large is read as an ultimate. */
export const ULTIMATE_LOYALTY_DROP = 6

function battlefieldSlots(permId: string): Element[] {
  return [...document.querySelectorAll(`.card-slot[data-card-id="${permId}"]`)].filter((el) => !el.closest(STACK_SELECTOR))
}

/** A phased-out permanent stops being drawn: a ghost of it fades out in place, scan lines and all. */
function phaseOut(permId: string, perm: CardView): void {
  if (!fxMotionAllowed()) return
  const rect = getPreviousCardPosition(permId) ?? getRect(`[data-card-id="${permId}"]`)
  if (!rect) return
  // A tapped card's rect is its rotated box: without a size the flight reads it as rotated and keeps it so.
  const sourceSize = (perm as { tapped?: boolean }).tapped === true ? null : getPreviousCardSize(permId)
  startCardFlight(perm, rect, rect, fxMotionDuration(PHASE_OUT_MS), undefined, { static: true, sourceSize, variant: 'phase' })
  spawnImpact('phase', rect)
}

function phaseIn(permId: string): void {
  if (!fxMotionAllowed()) return
  scheduleAfterLayout(() => {
    const slots = battlefieldSlots(permId)
    for (const slot of slots) replayClass(slot, 'fx-phase-in', fxMotionDuration(PHASE_OUT_MS) + 40)
    const rect = rectOf(slots[0])
    if (rect) spawnImpact('phase', rect)
  })
}

function loyaltyOf(card: CardView | undefined): number | null {
  const n = parseInt(String(card?.loyalty ?? ''), 10)
  return Number.isFinite(n) ? n : null
}

/**
 * Planeswalkers of `prevP` that paid an ultimate: loyalty dropped by at least
 * {@link ULTIMATE_LOYALTY_DROP} while staying, or the planeswalker left while a new ability of
 * its own went on the stack with at least that much loyalty to pay.
 */
export function ultimatePlaneswalkerIds(prevP: PlayerView, nextP: PlayerView, prevStack: Record<string, CardView>, nextStack: Record<string, CardView>): string[] {
  const nextBattlefield = nextP.battlefield ?? {}
  const newSources = new Set(Object.entries(nextStack)
    .filter(([id]) => !(id in prevStack))
    .map(([, s]) => s.sourceCard?.id)
    .filter((id): id is string => !!id))
  const out: string[] = []
  for (const [id, prevPerm] of Object.entries(prevP.battlefield ?? {})) {
    const before = loyaltyOf(prevPerm)
    if (before === null || before < ULTIMATE_LOYALTY_DROP) continue
    const after = id in nextBattlefield ? loyaltyOf(nextBattlefield[id]) : null
    if (after !== null ? before - after >= ULTIMATE_LOYALTY_DROP : newSources.has(id)) out.push(id)
  }
  return out
}

/**
 * The stack object a new spell copies: another spell of the same name already on the stack, while
 * no card of that name left its controller's hand (a cast from hand is a cast, not a copy).
 */
export function copiedSpellId(spellId: string, spell: CardView, prevGame: GameView, nextGame: GameView): string | null {
  if (spell.isAbility === true || isAbilityCard(spell)) return null
  const prevStack = prevGame.stack ?? {}
  const original = Object.entries(prevStack).find(([id, s]) => id !== spellId && s.name === spell.name && s.isAbility !== true && !isAbilityCard(s))
  if (!original) return null
  const ctrlId = spell.controllerId ?? spell.sourceCard?.controllerId
  const prevCtrl = (prevGame.players ?? []).find((p) => p.playerId === ctrlId)
  const nextCtrl = (nextGame.players ?? []).find((p) => p.playerId === ctrlId)
  if (prevCtrl?.controlled === true) {
    const nextHand = nextGame.myHand ?? {}
    const left = Object.entries(prevGame.myHand ?? {}).some(([id, c]) => !(id in nextHand) && c.name === spell.name)
    if (left) return null
  } else if (prevCtrl && nextCtrl && (nextCtrl.handCount ?? 0) < (prevCtrl.handCount ?? 0)) {
    return null
  }
  return original[0]
}

/**
 * My mulligan, in the views before the first phase: the hand cards that went back fly to the
 * library and the new hand is dealt from it, every card, in a quick stagger.
 */
function playMulligan(prevHand: Record<string, CardView>, nextHand: Record<string, CardView>, libRect: DOMRect, handRect: DOMRect, pSel: string): void {
  const returned = Object.keys(prevHand).filter((id) => !(id in nextHand)).slice(0, MULLIGAN_MAX_CARDS)
  const dealt = Object.keys(nextHand).filter((id) => !(id in prevHand)).slice(0, MULLIGAN_MAX_CARDS)
  returned.forEach((id, i) => {
    const from = getPreviousCardPosition(id)
    if (!from) return
    const card = { ...prevHand[id], faceDown: true }
    setTimeout(() => startCardFlight(card, from, libRect, MULLIGAN_RETURN_MS, undefined, { sourceSize: getPreviousCardSize(id) }), i * MULLIGAN_STAGGER_MS)
  })
  const dealFrom = returned.length > 0 ? MULLIGAN_RETURN_MS * 0.6 : 0
  dealt.forEach((id, i) => {
    setTimeout(() => {
      flyAfterLayout(id, nextHand[id], libRect, [
        `[data-card-id="${id}"]`,
        '.hand-bar .hand-card-slot:last-child',
        `${pSel} .hand-zone .hand-card-slot:last-child`,
      ], handRect, MULLIGAN_DEAL_MS)
    }, dealFrom + i * MULLIGAN_STAGGER_MS)
  })
}

/** Measured in the same frame as the update: a pod seat is just starting to fold into its strip, so the crack covers the whole seat. */
function eliminateSeat(playerId: string): void {
  const els = [...document.querySelectorAll(`.board-zone[data-player-id="${playerId}"], .defeated-seat[data-seat-id="${playerId}"]`)]
  const cells = els.map((el) => el.closest('.pod-cell, .arena-opp-cell') ?? el)
  const rect = cells.map(rectOf).find((r): r is DOMRect => !!r) ?? getRect(`.player-info-bar[data-player-id="${playerId}"]`)
  if (consumeConceded(playerId)) {
    for (const el of els) replayClass(el, 'fx-conceded', fxMotionDuration(1200) + 40)
    if (rect) spawnImpact('conceded', rect)
    return
  }
  for (const el of els) replayClass(el, 'fx-eliminated', fxMotionDuration(1400) + 40)
  if (rect) spawnImpact('eliminated', rect)
  soundManager.play('impact_heavy', 'game')
}
const SOURCE_PULSE_MS = 600

function pulseStackSource(cardId: string): void {
  const ms = fxMotionDuration(SOURCE_PULSE_MS)
  if (ms === 0) return
  const el = document.querySelector(`.card-slot[data-card-id="${cardId}"]`)
  if (!el) return
  el.classList.remove('stack-source-pulse')
  void (el as HTMLElement).offsetWidth
  el.classList.add('stack-source-pulse')
  setTimeout(() => el.classList.remove('stack-source-pulse'), ms)
}

export function detectAndAnimateTransitions(prevGame: GameView, nextGame: GameView, bannerDelayMs = 0) {
  if (!prevGame || !nextGame) return
  const combatants = new Set(combatantIds(prevGame))
  const strikePlans = planDamageStrikes(prevGame, nextGame)
  const strikes = playDamageStrikes(strikePlans, [...combatants])
  const keywordHits = playKeywordStrikes(planKeywordStrikes(prevGame, nextGame, strikePlans), strikes)
  keywordHits.playerHits.forEach((ms, id) => {
    if (!strikes.impactAt.has(id)) strikes.impactAt.set(id, ms)
  })
  const pendingLandings = new Map<string, { count: number; queue: Array<() => void> }>()
  const landed = (id: string) => {
    const pending = pendingLandings.get(id)
    if (!pending || --pending.count > 0) return
    pendingLandings.delete(id)
    releaseHeldHit(id)
    pending.queue.forEach((fn) => fn())
  }
  const afterLanding = (id: string, fallbackMs: number, fn: () => void) => {
    const pending = pendingLandings.get(id)
    if (pending) pending.queue.push(fn)
    else later(fallbackMs, fn)
  }
  const wiped = primeBoardWipe(prevGame, nextGame)
  if (wiped.length > 0 && fxMotionAllowed()) slamBoardWipe(wipeBoardRect())
  const deathDelay = (id: string) => (combatants.has(id) ? strikes.holdMs : 0) + boardWipeDelay(id)
  const changedControl = controlChanges(prevGame, nextGame)
  const controlIds = new Set(changedControl.map((c) => c.id))

  // 0. Turn start (first phased view of a turn) → banner centred on the active player, after the turn-1 coin when it runs
  if (nextGame.turn > 0 && nextGame.phase != null && (nextGame.turn !== prevGame.turn || prevGame.phase == null)) {
    const active = nextGame.players?.find((p) => p.isActive)
    const playerName = active?.name ?? nextGame.activePlayerName ?? ''
    later(bannerDelayMs, () => announceBanner(t('game', 'turn_banner_player', { turn: nextGame.turn, player: playerName })))
  }

  const stackEl = document.querySelector('.stack-zone, .stack-deck, .stack-list, [data-testid="drawer-tab-stack"]') as HTMLElement | null
  const stackRect = stackEl ? stackEl.getBoundingClientRect() : null

  // 1. Detect New Spells on the Stack (Hand/Battlefield -> Stack)
  const prevStack = prevGame.stack ?? {}
  const nextStack = nextGame.stack ?? {}
  const departures = stackDepartures(prevGame, nextGame)
  const enteredFromStack = departureIds(departures, 'battlefield')
  const fellFromStack = new Set([...departureIds(departures, 'graveyard'), ...departureIds(departures, 'exile')])
  const damageSpellResolved = resolvedDamageSpell(prevStack, nextStack)
  for (const [spellId, spell] of Object.entries(prevStack)) {
    if (spellId in nextStack) continue
    for (const targetId of stackTargetIds(spell)) {
      const pending = pendingLandings.get(targetId) ?? { count: 0, queue: [] }
      pending.count++
      pendingLandings.set(targetId, pending)
    }
  }

  for (const [spellId, spell] of Object.entries(nextStack)) {
    if (!(spellId in prevStack)) {
      const ctrlId = spell.controllerId ?? spell.sourceCard?.controllerId
      const ctrlName = spell.controllerName ?? spell.sourceCard?.controllerName
      const pSel = getPlayerSelector(ctrlId, ctrlName)

      let sourceRect: DOMRect | null = null
      let sourceSize: CardSourceSize | null = null

      if (isAbilityCard(spell) && spell.sourceCard?.id) pulseStackSource(spell.sourceCard.id)
      const weight = spellWeight(spell)
      if (weight > 0) pendingSlams.set(spellId, spell)

      // 1-copy. A copy clones itself out of the spell it copies, with an echo, instead of flying from a hand.
      const originalId = copiedSpellId(spellId, spell, prevGame, nextGame)
      if (originalId) {
        const originalSource = stackSpellSource(originalId)
        const fromRect = originalSource?.rect ?? getRect(`[data-card-id="${originalId}"]`) ?? stackRect
        if (fromRect && stackRect) {
          spawnImpact('copy', fromRect)
          flyAfterLayout(spellId, spell, fromRect, [
            `[data-card-id="${spellId}"] .stack-thumb`,
            `[data-card-id="${spellId}"] .stack-tl-card`,
            `[data-card-id="${spellId}"]`,
          ], stackRect, COPY_FLIGHT_MS, originalSource?.size ?? null, 'copy')
        }
        continue
      }

      // 1-command. A commander cast from the command zone lifts out of it, in the crown's gold light.
      const commanderId = pSel ? castFromCommand(spell, spellId, prevGame, nextGame) : null
      if (commanderId) {
        sourceRect = getPreviousCardPosition(commanderId) ?? getRect(`${pSel} .command-zone`)
        sourceSize = getPreviousCardSize(commanderId)
        if (sourceRect) spawnImpact('command', sourceRect)
      }

      // 1-pile. Cast from a graveyard or exile (flashback, escape, foretell, adventure, plot): it lifts out of that pile.
      const cast = castCard(spellId, spell, prevGame, nextGame)
      const castPile = !sourceRect && pSel && (cast?.zone === 'graveyard' || cast?.zone === 'exile') ? cast.zone : null
      if (castPile) {
        sourceRect = getRect(`${pSel} ${castPile === 'graveyard' ? GRAVE_PILE : EXILE_PILE}`)
        sourceSize = pileSize(sourceRect)
      }

      // 1a. Check cardPositionRegistry first (card just unmounted from hand/battlefield)
      const srcId = cast?.zone === 'hand' ? cast.id : spell.sourceCard?.id ?? spell.id
      if (!sourceRect && srcId) {
        const registered = getPreviousCardPosition(srcId)
        if (registered) {
          sourceRect = registered
          sourceSize = getPreviousCardSize(srcId)
        }
      }

      // 1b. Check if source card is still visible on battlefield (its copy already drawn in the stack is the destination, not the source)
      if (!sourceRect && srcId) {
        const sourceEl = [...document.querySelectorAll<HTMLElement>(`[data-card-id="${srcId}"]`)].find((el) => !el.closest(STACK_SELECTOR))
        sourceRect = rectOf(sourceEl)
        const tile = sourceRect ? sourceEl?.closest<HTMLElement>('.card-slot.is-compact') : null
        if (tile && tile.offsetWidth > 0 && tile.offsetHeight > 0) sourceSize = { w: tile.offsetWidth, h: tile.offsetHeight, compact: true }
      }

      // 1c. Fallback: player's hand zone
      if (!sourceRect && pSel) {
        sourceRect = getRect(`${pSel} .hand-zone`)
      }

      // 1d. Fallback: player zone
      if (!sourceRect && pSel) {
        sourceRect = getRect(pSel)
      }

      if (sourceRect && stackRect) {
        const lift = !isAbilityCard(spell) && fxMotionAllowed()
        flyAfterLayout(spellId, spell, sourceRect, [
          `[data-card-id="${spellId}"] .stack-thumb`,
          `[data-card-id="${spellId}"] .stack-tl-card`,
          `[data-card-id="${spellId}"]`,
        ], stackRect, lift ? CAST_FLIGHT_MS : 380, sourceSize, weight > 0 ? 'heavy' : undefined, isAbilityCard(spell) ? undefined : 'gold', lift)
      } else if (!sourceRect) {
        noteFlightEvent({ kind: 'skip', reason: 'no-source', cardId: spellId, detail: `stack-enter:${spell.name ?? ''}` })
      }
    }
  }
  slamResolvedSpells(nextGame, departures)
  flyReattached(prevGame, nextGame)

  // 2. Detect Player-specific Transitions (Draws, Lands, Battlefield Resolves, Graveyard)
  const nextPlayers = nextGame.players ?? []
  const prevPlayers = prevGame.players ?? []

  for (const nextP of nextPlayers) {
    const prevP = prevPlayers.find((p) => p.playerId === nextP.playerId || p.name === nextP.name)
    if (!prevP) continue

    const pSel = getPlayerSelector(nextP.playerId, nextP.name)
    if (!pSel) continue

    const libRect = getRect(`${pSel} :is(.library-stack, .library-chip)`)
    const graveRect = getRect(`${pSel} ${GRAVE_PILE}`)
    const exileRect = getRect(`${pSel} ${EXILE_PILE}`)

    // A) Card Draws (Library -> Hand)
    // Use real hand IDs when available (controlled player), else fall back to handCount delta
    const isControlled = nextP.controlled === true
    // La mano del jugador controlado vive en la barra dedicada (fuera de la zona)
    const handRect = isControlled
      ? (getRect('.hand-bar') ?? getRect(`${pSel} .hand-zone`))
      : getRect(`${pSel} .hand-zone`)
    if (isControlled) {
      const prevHand = prevGame.myHand ?? {}
      const nextHand = nextGame.myHand ?? {}
      const drawnIds = Object.keys(nextHand).filter((id) => !(id in prevHand))
      const mulligan = nextGame.phase == null && Object.keys(prevHand).some((id) => !(id in nextHand))
      if (mulligan && libRect && handRect) {
        if (fxMotionAllowed()) playMulligan(prevHand, nextHand, libRect, handRect, pSel)
      } else if (drawnIds.length > 0 && libRect && handRect) {
        const returns = myHandReturns(prevGame, nextGame)
        const capped = drawnIds.slice(0, 3)
        capped.forEach((id, i) => {
          const pile = returns.get(id)
          const fromRect = (pile === 'graveyard' ? graveRect : pile === 'exile' ? exileRect : null) ?? libRect
          const drawn = nextHand[id]
          const dummyCard: CardView = drawn ?? {
            id,
            name: 'Magic Card',
            manaValue: 0,
            expansionSetCode: '',
            cardNumber: '0',
            faceDown: true,
          }
          setTimeout(() => {
            flyAfterLayout(id, dummyCard, fromRect, [
              `[data-card-id="${id}"]`,
              '.hand-bar .hand-card-slot:last-child',
              `${pSel} .hand-zone .hand-card-slot:last-child`,
            ], handRect, pile ? HAND_RETURN_MS : 320, pile ? pileSize(fromRect) : null)
          }, i * 70)
        })
      }
    } else {
      const prevHandCount = prevP.handCount ?? 0
      const nextHandCount = nextP.handCount ?? 0
      const bouncedCount = opponentBounceIds(prevP, nextP, nextGame).length
      const returned = opponentHandReturns(prevP, nextP, nextGame)
      const handBadge = `.player-info-bar[data-player-id="${nextP.playerId}"] .pp-hand-badge`
      const returnRect = handRect ?? getRect(handBadge)
      if (returnRect) {
        returned.slice(0, 3).forEach(({ id, pile, card }, i) => {
          const fromRect = pile === 'graveyard' ? graveRect : exileRect
          setTimeout(() => {
            flyAfterLayout(id, card, fromRect, [
              `${pSel} .hand-zone .hand-card-slot:last-child`,
              `${pSel} .hand-zone`,
              handBadge,
            ], returnRect, HAND_RETURN_MS, pileSize(fromRect))
          }, i * 70)
        })
      }
      if (nextHandCount - bouncedCount - returned.length > prevHandCount && libRect && handRect) {
        const drawnCount = Math.min(3, nextHandCount - bouncedCount - returned.length - prevHandCount)
        for (let i = 0; i < drawnCount; i++) {
          const drawnId = `draw-${nextP.playerId}-${Date.now()}-${i}`
          const dummyCard: CardView = {
            id: drawnId,
            name: 'Magic Card',
            manaValue: 0,
            expansionSetCode: '',
            cardNumber: '0',
            faceDown: true,
          }
          setTimeout(() => {
            flyAfterLayout(drawnId, dummyCard, libRect, [
              `${pSel} .hand-zone .hand-card-slot:last-child`,
            ], handRect, 320)
          }, i * 70)
        }
      }
    }

    // P) Put on the library (Brainstorm, Chaos Warp, a tuck): each card flies to the library pile and
    //    turns face down on the way; an opponent's hand cards leave it already face down.
    const libSel = `${pSel} :is(.library-stack, .library-chip)`
    const tucks = libraryTucks(prevP, nextP, prevGame, nextGame)
    const tuckedPermanents = new Set(tucks.permanents)
    if (fxMotionAllowed()) {
      tucks.hand.slice(0, 3).forEach((id, i) => {
        const card = (prevGame.myHand ?? {})[id]
        const from = getPreviousCardPosition(id)
        const size = getPreviousCardSize(id)
        later(i * 90, () => tuckToLibrary(id, card, from ?? handRect, size, libSel, libRect, false))
      })
      const hiddenFrom = handRect ?? getRect(`.player-info-bar[data-player-id="${nextP.playerId}"] .pp-hand-badge`)
      for (let i = 0; i < Math.min(3, tucks.hidden); i++) {
        const id = `tuck-${nextP.playerId}-${Date.now()}-${i}`
        const card: CardView = { id, name: 'Magic Card', manaValue: 0, expansionSetCode: '', cardNumber: '0', faceDown: true }
        later(i * 90, () => tuckToLibrary(id, card, hiddenFrom, null, libSel, libRect, false))
      }
    }

    // G) Descartes y molino (-> cementerio sin pasar por el campo): la pila
    //    del cementerio actualiza su top in-place (sin montar slot), así que
    //    el camino A nunca dispara y hace falta vuelo del engine. Se excluyen
    //    las llegadas ya cubiertas por C (campo) y E (stack).
    const prevGraveIds = prevP.graveyard ?? {}
    const nextGraveIds = nextP.graveyard ?? {}
    const graveArrivals = Object.keys(nextGraveIds).filter((id) => !(id in prevGraveIds))
    const handShrank = (nextP.handCount ?? 0) < (prevP.handCount ?? 0)
    if (graveArrivals.length > 0 && graveRect) {
      graveArrivals.slice(0, 3).forEach((id, i) => {
        if (id in (prevP.battlefield ?? {}) || id in prevStack || fellFromStack.has(id)) return
        const arrived = (nextGraveIds as Record<string, CardView>)[id]
        setTimeout(() => {
          const registered = getPreviousCardPosition(id)
          const fromHand = isControlled ? id in (prevGame.myHand ?? {}) : handShrank
          const originRect =
            registered ??
            (fromHand ? (getRect(`[data-card-id="${id}"]`) ?? handRect ?? libRect) : (libRect ?? handRect))
          if (!originRect) {
            noteFlightEvent({ kind: 'skip', reason: 'no-source', cardId: id, detail: 'discard' })
            return
          }
          flyAfterLayout(id, arrived, originRect, [
            `${pSel} :is(.graveyard-stack, .graveyard-chip) [data-card-id="${id}"]`,
            `${pSel} :is(.graveyard-stack, .graveyard-chip)`,
          ], graveRect, 350, registered ? getPreviousCardSize(id) : null)
        }, i * 70)
      })
    }

    // K) Exiled from the hand, the graveyard or the library (delve, escape, cascade, impulse draw):
    //    the exile pile updates in place, so the engine flies each arrival there with the exile flash.
    //    A card leaving a hidden zone (the library, an opponent's hand) turns face up on the way.
    if (exileRect) {
      exileArrivals(prevP, nextP, prevGame, fellFromStack).slice(0, 3).forEach(({ id, origin }, i) => {
        const arrived = (nextP.exile ?? {})[id]
        setTimeout(() => {
          const registered = getPreviousCardPosition(id)
          const originRect = registered ?? (origin === 'graveyard'
            ? graveRect
            : origin === 'hand' ? (getRect(`[data-card-id="${id}"]`) ?? handRect ?? libRect) : (libRect ?? handRect))
          if (!originRect) {
            noteFlightEvent({ kind: 'skip', reason: 'no-source', cardId: id, detail: `exile-from-${origin}` })
            return
          }
          const hidden = origin === 'library' || (origin === 'hand' && !isControlled)
          spawnImpact('exile', originRect)
          flyAfterLayout(id, arrived, originRect, [
            `${pSel} ${EXILE_PILE} [data-card-id="${id}"]`,
            `${pSel} ${EXILE_PILE}`,
          ], exileRect, EXILE_ARRIVAL_MS, registered ? getPreviousCardSize(id) : pileSize(originRect), 'exile', undefined, undefined, hidden)
        }, i * 70)
      })
    }

    // B) Permanent Enters Battlefield (Stack -> Battlefield, or Hand -> Battlefield for Lands)
    const prevBattlefield = prevP.battlefield ?? {}
    const nextBattlefield = nextP.battlefield ?? {}

    const auraHosts = new Map(auraAttachments(prevP, nextP, nextGame).map((a) => [a.id, a.hostId]))
    for (const [permId, perm] of Object.entries(nextBattlefield)) {
      if (!(permId in prevBattlefield) && !controlIds.has(permId)) {
        const wasInStack = permId in prevStack || (perm.parentId && perm.parentId in prevStack) || enteredFromStack.has(permId)

        let originRect: DOMRect | null = null
        let originSize: CardSourceSize | null = null

        // Check registry first: card may have just unmounted from hand/stack
        const prevRegistered = getPreviousCardPosition(permId)
        if (prevRegistered) {
          originRect = prevRegistered
          originSize = getPreviousCardSize(permId)
        } else if (wasInStack) {
          originRect = stackRect
        } else if (permId in (prevP.exile ?? {})) {
          originRect = exileRect ?? handRect
          originSize = pileSize(exileRect)
        } else if (permId in (prevP.graveyard ?? {})) {
          // Reanimar: el origen real es la pila del cementerio, no la mano.
          originRect = graveRect
          originSize = pileSize(graveRect)
        } else {
          originRect = handRect
        }

        if ((perm as { isToken?: boolean }).isToken && !wasInStack) {
          scheduleAfterLayout(() => spawnImpact('token-pop', getRect(`[data-card-id="${permId}"]`)))
        }

        if (originRect) {
          const enteringLand = !wasInStack && (perm.cardTypes ?? []).some((t) => String(t).toUpperCase() === 'LAND')
          flyAfterLayout(permId, perm, originRect, [
            `[data-card-id="${permId}"]`,
            `${pSel} .creatures-band [data-card-id="${permId}"]`,
            `${pSel} .creatures-band`,
            `${pSel} .permanents-band`,
          ], getRect(`${pSel} .creatures-band`) ?? getRect(`${pSel} .permanents-band`), ENTER_FLIGHT_MS, originSize, enteringLand ? 'land' : 'enter')
        } else {
          noteFlightEvent({ kind: 'skip', reason: 'no-source', cardId: permId, detail: `bf-enter:${(perm as { name?: string }).name ?? ''}` })
        }

        // B-aura) An aura (or bestow) binds itself to its host once its drop lands.
        const hostId = auraHosts.get(permId)
        if (hostId) later(originRect && fxMotionAllowed() ? fxDuration(ENTER_FLIGHT_MS * ENTER_LAND_AT) + 40 : 0, () => linkAura(permId, hostId, perm))
      }
    }

    // C) El permanente sale del campo: cementerio, exilio o mano (bounce).
    //    Cada destino tiene su vuelo; lo que no llega a ningún lado visible
    //    (token que deja de existir, carta a la biblioteca) no vuela — antes
    //    volaba un fantasma erróneo al cementerio en todos los casos.
    const myHandIds = nextGame.myHand ?? {}
    const opponentBounces = new Set(isControlled ? [] : opponentBounceIds(prevP, nextP, nextGame))
    for (const [permId, perm] of Object.entries(prevBattlefield)) {
      if (permId in nextBattlefield || controlIds.has(permId)) continue
      const inGrave = permId in (nextP.graveyard ?? {})
      const inExile = permId in (nextP.exile ?? {})
      const bouncedToHand = permId in myHandIds
      const bouncedToOpponentHand = opponentBounces.has(permId)
      const registered = getPreviousCardPosition(permId)
      if (bouncedToOpponentHand) {
        const fromRect = registered ?? getRect(`[data-card-id="${permId}"]`)
        if (!fromRect) {
          noteFlightEvent({ kind: 'skip', reason: 'no-source', cardId: permId, detail: 'bf-bounce' })
          continue
        }
        const prevSize = registered ? getPreviousCardSize(permId) : null
        afterLanding(permId, deathDelay(permId), () => {
          spawnImpact('bounce', fromRect)
          flyAfterLayout(permId, perm, fromRect, [
            `${pSel} .hand-zone .hand-card-slot:last-child`,
            `${pSel} .hand-zone`,
            `.player-info-bar[data-player-id="${nextP.playerId}"] .pp-hand-badge`,
            `.player-info-bar[data-player-id="${nextP.playerId}"]`,
          ], handRect ?? getRect(`.player-info-bar[data-player-id="${nextP.playerId}"]`), BOUNCE_FLIGHT_MS, prevSize)
        })
        continue
      }
      if (tuckedPermanents.has(permId)) {
        const size = registered ? getPreviousCardSize(permId) : null
        const from = registered ?? getRect(`[data-card-id="${permId}"]`)
        if (fxMotionAllowed()) afterLanding(permId, deathDelay(permId), () => tuckToLibrary(permId, perm, from, size, libSel, libRect, true))
        continue
      }
      if (!inGrave && !inExile && !bouncedToHand) {
        if ((perm as { isToken?: boolean }).isToken) {
          const fadeRect = registered ?? getRect(`[data-card-id="${permId}"]`)
          afterLanding(permId, deathDelay(permId), () => spawnImpact(consumeSacrificed(permId) ? 'sacrifice' : 'token-fade', fadeRect))
        }
        continue
      }
      const prevCardRect = registered ?? getRect(`[data-card-id="${permId}"]`)
      if (!prevCardRect) {
        noteFlightEvent({ kind: 'skip', reason: 'no-source', cardId: permId, detail: 'bf-leave' })
        continue
      }
      const prevSize = registered ? getPreviousCardSize(permId) : null
      afterLanding(permId, deathDelay(permId), () => {
        if (inExile) {
          spawnImpact('exile', prevCardRect)
          flyAfterLayout(permId, perm, prevCardRect, [
            `${pSel} ${EXILE_PILE} [data-card-id="${permId}"]`,
            `${pSel} ${EXILE_PILE}`,
          ], exileRect, 420, prevSize, 'exile')
        } else if (bouncedToHand) {
          spawnImpact('bounce', prevCardRect)
          flyAfterLayout(permId, perm, prevCardRect, [
            `[data-card-id="${permId}"]`,
            '.hand-bar .hand-card-slot:last-child',
            `${pSel} .hand-zone .hand-card-slot:last-child`,
          ], getRect('.hand-bar') ?? getRect(`${pSel} .hand-zone`), 350, prevSize)
        } else {
          // Destino con ámbito al cementerio: el id puede seguir presente como
          // top-card del propio montón del cementerio (nunca el slot de origen).
          const isLand = (perm.cardTypes ?? []).some((t) => String(t).toUpperCase() === 'LAND')
          const sacrificed = consumeSacrificed(permId)
          if (sacrificed) spawnImpact('sacrifice', prevCardRect)
          else if (!isLand) spawnImpact('destroy', prevCardRect)
          flyAfterLayout(permId, perm, prevCardRect, [
            `${pSel} :is(.graveyard-stack, .graveyard-chip) [data-card-id="${permId}"]`,
          ], graveRect, isLand && !sacrificed ? 350 : 420, prevSize, sacrificed ? 'sacrifice' : isLand ? undefined : 'destroy')
        }
      })
    }

    // E) Transform / day-night: the permanent stays but shows its other face.
    for (const [permId, nextPerm] of Object.entries(nextBattlefield)) {
      const prevPerm = prevBattlefield[permId]
      if (prevPerm && (prevPerm.transformed === true) !== (nextPerm.transformed === true)) flipTransformed(permId)
    }

    // E2) Turned face up (morph, manifest, disguise, cloak): the permanent stays and shows its face.
    for (const { id } of turnedFaceUp(prevP, nextP)) afterLanding(id, 0, () => revealFaceUp(id, nextBattlefield[id]))

    // Q) Became a creature or stopped being one (an animated land, a crewed vehicle): it rises into the creature band, or settles back.
    for (const shift of creatureShifts(prevP, nextP)) afterLanding(shift.id, 0, () => shiftCreature(shift, nextBattlefield[shift.id]))

    // R) A flip card turned over: it turns a half circle with a flash.
    for (const id of flippedChanges(prevP, nextP)) afterLanding(id, 0, () => turnFlipCard(id, nextBattlefield[id]?.flipped === true, nextBattlefield[id]))

    // L) Power/toughness changed (a pump, a shrink, an anthem): the P/T box pops with the difference.
    for (const change of ptChanges(prevP, nextP)) afterLanding(change.id, 0, () => pulsePt(change))

    // F) Phasing: a phased-out permanent is not drawn, so it fades out as a ghost; one phasing in fades up.
    for (const [permId, nextPerm] of Object.entries(nextBattlefield)) {
      const prevPerm = prevBattlefield[permId]
      if (!prevPerm) continue
      const wasIn = prevPerm.phasedIn !== false
      const isIn = nextPerm.phasedIn !== false
      if (wasIn && !isIn) phaseOut(permId, prevPerm)
      else if (!wasIn && isIn) phaseIn(permId)
    }

    // H) Planeswalker ultimate: a big loyalty cost slams the board from the planeswalker.
    for (const permId of ultimatePlaneswalkerIds(prevP, nextP, prevStack, nextStack)) {
      const fromRect = getPreviousCardPosition(permId)
      scheduleAfterLayout(() => slamUltimate(rectOf(battlefieldSlots(permId)[0]) ?? fromRect ?? getRect(`[data-card-id="${permId}"]`)))
    }

    // I) A player leaves the game: their seat cracks and dims.
    if (prevP.hasLeft !== true && nextP.hasLeft === true) eliminateSeat(nextP.playerId)

    // D) Combat/ability damage feedback: creatures and players that lost life shake
    //    + floating damage numbers on top of the hit element.
    for (const [permId, nextPerm] of Object.entries(nextBattlefield)) {
      const prevPerm = prevBattlefield[permId] as { damage?: number } | undefined
      const prevDamage = typeof prevPerm?.damage === 'number' ? prevPerm.damage : 0
      const nextDamage = typeof (nextPerm as { damage?: number }).damage === 'number'
        ? (nextPerm as { damage?: number }).damage ?? 0
        : 0
      if (nextDamage > prevDamage) {
        const sel = `[data-card-id="${permId}"]`
        const struckAt = strikes.impactAt.get(permId)
        const hit = () => {
          if (struckAt === undefined) shakeElement(sel)
          const el = document.querySelector(sel) as HTMLElement | null
          if (!el) return
          const rect = el.getBoundingClientRect()
          if (document.querySelector(`.card-slot${sel}`)) spawnDamageNumber(`card:${permId}`, nextDamage - prevDamage)
          if (survivesLethal(nextPerm)) spawnImpact('indestructible', rect)
          if (struckAt === undefined) spawnImpact('sparks', rect)
        }
        if (struckAt === undefined) afterLanding(permId, 0, hit)
        else later(struckAt, hit)
      }
    }

    const prevLife = prevP.life ?? 0
    const nextLife = nextP.life ?? 0
    const lifeStruckAt = strikes.impactAt.get(nextP.playerId)
    const lifeLost = nextLife < prevLife
    const lifeDamage = lifeLost && (lifeStruckAt !== undefined || damageSpellResolved)
    const lifeHit = () => {
      const playerEls = Array.from(document.querySelectorAll(`[data-player-id="${nextP.playerId}"]`))
      const deepest = playerEls.reduce<Element | null>((acc, el) => (!acc || acc.contains(el) ? el : acc), null)
      if (deepest) {
        if (lifeLost) {
          if (!lifeDamage) return
          if (lifeStruckAt === undefined) {
            deepest.classList.remove('took-damage')
            void (deepest as HTMLElement).offsetWidth
            deepest.classList.add('took-damage')
            setTimeout(() => deepest.classList.remove('took-damage'), 420)
            spawnImpact('sparks', deepest.getBoundingClientRect())
          }
          if (document.querySelector(`.player-info-bar[data-player-id="${nextP.playerId}"]`)) {
            spawnDamageNumber(`player:${nextP.playerId}`, prevLife - nextLife)
          }
          return
        }
        const rect = deepest.getBoundingClientRect()
        spawnFloater(`life:${nextP.playerId}`, rect, `+${nextLife - prevLife}`, 'good')
        spawnImpact('heal', rect)
        replayClass(deepest, 'gained-life', fxMotionDuration(900) + 40)
      }
    }
    if (nextLife !== prevLife) {
      const gainAt = nextLife > prevLife ? keywordHits.lifeGains.get(nextP.playerId) : undefined
      if (gainAt !== undefined) later(gainAt, lifeHit)
      else if (lifeStruckAt === undefined) afterLanding(nextP.playerId, 0, lifeHit)
      else later(lifeStruckAt, lifeHit)
    }

    // M) Player counters (poison, energy, experience, rad, tickets…): the change floats up from the badge, after the strike that dealt it.
    for (const change of playerCounterChanges(prevP, nextP)) {
      const play = () => animatePlayerCounter(nextP.playerId, change)
      if (lifeStruckAt === undefined) afterLanding(nextP.playerId, 0, play)
      else later(lifeStruckAt, play)
    }
  }

  // N) Control changes (Threaten, Control Magic, the effect ending): a tether pulls the permanent to its new controller.
  for (const change of changedControl) {
    const wasTapped = (prevPlayers.find((p) => p.playerId === change.from)?.battlefield?.[change.id] as { tapped?: boolean } | undefined)?.tapped === true
    if (fxMotionAllowed()) afterLanding(change.id, 0, () => pullControlled(change, nextGame, wasTapped))
  }

  // O) A commander goes back to the command zone (from the battlefield, its graveyard or exile, my hand).
  if (fxMotionAllowed()) {
    for (const ret of commanderReturns(prevGame, nextGame)) {
      const owner = prevPlayers.find((p) => p.playerId === ret.playerId)
      const ownerSel = owner ? getPlayerSelector(owner.playerId, owner.name) : ''
      const pile = ret.origin === 'graveyard' ? GRAVE_PILE : ret.origin === 'exile' ? EXILE_PILE : null
      sendToCommand(ret, nextGame, pile && ownerSel ? getRect(`${ownerSel} ${pile}`) : null)
    }
  }

  // S) Emblems, dungeon rooms and planes: the command zone shows what arrived.
  animateCommandArrivals(prevGame, nextGame)

  // U) Mana paid for a new spell or ability leaves the pool display for the stack.
  if (fxMotionAllowed()) {
    for (const spend of manaSpends(prevGame, nextGame)) {
      const controlled = nextPlayers.find((p) => p.playerId === spend.playerId)?.controlled === true
      scheduleAfterLayout(() => flySpentMana(spend, controlled, stackRect))
    }
  }

  // T) An opponent's hand revealed to me fans out face up.
  fanRevealedHands(prevGame, nextGame)

  // C) Spells that left the stack resolve one at a time: stackHold keeps each one on display
  //    until its turn ends. Its projectiles fly to its targets (each target's hit waits for the
  //    landing), then it exits to the graveyard/exile or flashes in place. Positions are read
  //    now, while the spell is still on display. A countered spell fires nothing: it cracks
  //    and shatters where it stands, then falls to its graveyard.
  const countered = counteredSpellIds(prevGame, nextGame, departures)
  const merges = mutateMerges(prevGame, nextGame)
  for (const [spellId, spell] of Object.entries(prevStack)) {
    if (spellId in nextStack) continue
    const registered = getPreviousCardPosition(spellId)
    const prevRect = registered ?? getRect(`[data-card-id="${spellId}"]`)
    const prevSize = registered ? getPreviousCardSize(spellId) : null
    const colors = cardManaColors(spell)
    const targetIds = stackTargetIds(spell)
    const departure = departures.get(spellId)
    const entersBattlefield = departure?.zone === 'battlefield' || nextPlayers.some((p) => spellId in (p.battlefield ?? {}))
    const mergeHost = merges.get(spellId)
    const fizzled = !countered.has(spellId) && consumeFizzled(spellId)
    enqueueStackResolve(spellId, (done) => {
      const exit = () => {
        if (prevRect && mergeHost) {
          const source = stackSpellSource(spellId)
          mergeIntoHost(spellId, spell, source?.rect ?? prevRect, source?.size ?? prevSize, mergeHost)
        } else if (prevRect && !entersBattlefield) {
          const source = stackSpellSource(spellId)
          playStackSpellExit(spellId, spell, source?.rect ?? prevRect, source?.size ?? prevSize, nextPlayers, departure)
        }
        later(STACK_EXIT_MS, done)
      }
      if (!prevRect) {
        noteFlightEvent({ kind: 'skip', reason: 'no-source', cardId: spellId, detail: 'stack-resolve' })
        for (const targetId of targetIds) landed(targetId)
        done()
        return
      }
      if (countered.has(spellId)) {
        for (const targetId of targetIds) landed(targetId)
        const shown = [...document.querySelectorAll(`[data-card-id="${spellId}"]`)].find((el) => el.closest(STACK_SELECTOR))
        const ms = fxMotionDuration(COUNTERED_MS)
        if (shown) replayClass(shown, 'fx-countered-shake', ms + 200)
        spawnImpact('countered', stackSpellSource(spellId)?.rect ?? prevRect)
        soundManager.play('destroy', 'game')
        later(ms, exit)
        return
      }
      if (fizzled) {
        for (const targetId of targetIds) landed(targetId)
        const shown = [...document.querySelectorAll(`[data-card-id="${spellId}"]`)].find((el) => el.closest(STACK_SELECTOR))
        const ms = fxMotionDuration(FIZZLE_MS)
        if (shown) replayClass(shown, 'fx-fizzle', ms + 200)
        later(ms, exit)
        return
      }
      if (targetIds.length === 0) {
        exit()
        return
      }
      let inFlight = targetIds.length
      scheduleAfterLayout(() => {
        for (const targetId of targetIds) {
          const measure = () => getRect(`[data-card-id="${targetId}"]`) ?? getRect(`.player-info-bar[data-player-id="${targetId}"]`)
          const arrived = () => {
            landed(targetId)
            if (--inFlight === 0) exit()
          }
          if (!spawnProjectile(stackSpellSource(spellId)?.rect ?? prevRect, measure, colors, arrived)) arrived()
        }
      })
    }, () => {
      for (const targetId of targetIds) landed(targetId)
    })
  }

  // J) Monarch / initiative changes hands: the crown flies from its old holder to the new one.
  for (const passed of passedDesignations(prevGame, nextGame)) {
    scheduleAfterLayout(() => spawnDesignationFlight(passed.kind, passed.from, passed.to))
  }

  snapshotCombatants(nextGame)
}

/**
 * {@code gameId} is the store's: a `GameView` carries no id of its own. Two views of different
 * games (a spectator following the next game, the next game of a match) are never diffed into
 * animations; the id is recorded with the view it arrived with, because the store switches it
 * on `START_GAME`, before the new game's first view.
 */
export function useGameTransitions(game: GameView | null, gameId: string | null) {
  const prevGameRef = useRef<GameView | null>(null)
  const prevGameIdRef = useRef<string | null>(null)
  useMemo(() => {
    primeCombatHolds(prevGameRef.current, game)
    primeHandReturns(myHandReturns(prevGameRef.current, game))
    primeBoardWipe(prevGameRef.current, game)
    primeControlChanges(prevGameRef.current, game)
    primeCommandReturns(prevGameRef.current, game)
    primeStackEntries(prevGameRef.current, game)
    primeCreatureShifts(prevGameRef.current, game)
  }, [game])

  useEffect(() => {
    if (!game) {
      prevGameRef.current = null
      prevGameIdRef.current = null
      cancelPendingTransitions()
      clearPendingSlams()
      clearCombatSnapshots()
      clearBoardWipe()
      clearControlChanges()
      clearCommandReturns()
      clearCreatureShifts()
      return
    }

    const prevGame = prevGameRef.current
    if (prevGame === game) return
    const coinMs = observeCoinFlip(game, gameId)
    if (prevGame) {
      const prevId = prevGameIdRef.current
      if (gameId && prevId && gameId !== prevId) {
        cancelPendingTransitions()
        clearCardPositionRegistry()
        clearPendingSlams()
        clearCombatSnapshots()
      } else {
        detectAndAnimateTransitions(prevGame, game, coinMs)
      }
    }

    prevGameRef.current = game
    prevGameIdRef.current = gameId
  }, [game, gameId])
}
