import type { CardView } from '../net/types'
import { cleanMageText } from '../game/gameEventParser'
import { getState } from '../state/state'
import { soundManager } from '../audio/soundManager'
import { fxMotionAllowed, fxMotionDuration } from './fx'
import { spawnImpact } from './impactFx'
import { onFlightLanded, startCardFlight } from './flightManager'
import { sniffDiceRoll } from './diceRollFx'
import { sniffFizzle } from './fizzleFx'
import { sniffBehold } from './beholdFx'
import { sniffConcede } from './concedeFx'
import { sniffPlayerLogFx } from './playerLogFx'
import { spawnLibraryPeek } from './libraryPeekFx'

const OBJECT_ID_RE = /object_id='([0-9a-fA-F-]{36})'/

/** The first object id the log line links after `from`: player names carry none, permanents do. */
export function objectIdAfter(message: string, from: number): string | null {
  return OBJECT_ID_RE.exec(message.slice(Math.max(0, from)))?.[1] ?? null
}

/**
 * `PlayerImpl.moveCards` logs a return as "<player> puts <permanent> from exile onto the
 * Battlefield". A flickered permanent keeps its id, so the `GameView` diff sees nothing: this line
 * is the only trace.
 */
export function parseFlicker(message: string): { objectId: string } | null {
  const at = message.search(/\bputs\b/i)
  if (at < 0 || !/\bfrom exile onto the battlefield\b/i.test(cleanMageText(message))) return null
  const objectId = objectIdAfter(message, at)
  return objectId ? { objectId } : null
}

/** `PermanentImpl.sacrifice`: "<player> sacrificed <permanent> (source: …)". */
export function parseSacrifice(message: string): { objectId: string } | null {
  const at = message.search(/\bsacrificed\b/i)
  if (at < 0) return null
  const objectId = objectIdAfter(message, at)
  return objectId ? { objectId } : null
}

/** `Mulligan.mulligan`: "<player> decides to take mulligan". */
export function parseMulligan(message: string): { player: string } | null {
  const m = cleanMageText(message).match(/^(.+?) decides to take mulligan\b/i)
  const player = m?.[1]?.trim()
  return player ? { player } : null
}

/** `PlayerImpl.scry` / `doSurveil`: "<player> scries N (source: …)" / "<player> surveils N (source: …)". */
export function parseLibraryPeek(message: string): { player: string; kind: 'scry' | 'surveil'; amount: number } | null {
  const m = cleanMageText(message).match(/^(.+?) (scries|surveils) (\d+)\b/i)
  if (!m) return null
  const player = m[1].trim()
  const amount = Number(m[3])
  if (!player || amount === 0) return null
  return { player, kind: m[2].toLowerCase() === 'scries' ? 'scry' : 'surveil', amount }
}

const SACRIFICE_TTL_MS = 5000
const sacrificed = new Map<string, number>()

export function noteSacrificed(id: string): void {
  sacrificed.set(id, Date.now())
}

/** True once for a permanent the log reported sacrificed in the last few seconds. */
export function consumeSacrificed(id: string): boolean {
  const at = sacrificed.get(id)
  if (at === undefined) return false
  sacrificed.delete(id)
  return Date.now() - at <= SACRIFICE_TTL_MS
}

export function clearSacrificed(): void {
  sacrificed.clear()
}

export function afterLayout(fn: () => void): void {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(fn))
  else setTimeout(fn, 34)
}

export function visibleRect(el: Element | null | undefined): DOMRect | null {
  if (!el) return null
  const rect = el.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0 ? rect : null
}

export function replayClass(el: Element, cls: string, ms: number): void {
  el.classList.remove(cls)
  void (el as HTMLElement).offsetWidth
  el.classList.add(cls)
  setTimeout(() => el.classList.remove(cls), ms)
}

const FLICKER_MS = 700

/** The permanent blinks out and back in where it stands. */
export function flickerPermanent(permId: string): void {
  if (!fxMotionAllowed() || typeof document === 'undefined') return
  afterLayout(() => {
    const slots = [...document.querySelectorAll(`.card-slot[data-card-id="${permId}"]`)].filter((el) => !el.closest('.stack-zone'))
    const rect = visibleRect(slots[0])
    if (!rect) return
    const ms = fxMotionDuration(FLICKER_MS)
    for (const slot of slots) replayClass(slot, 'fx-flicker', ms + 40)
    spawnImpact('flicker', rect)
    soundManager.play('exile', 'game')
  })
}

const MULLIGAN_CARDS = 4
const MULLIGAN_STAGGER_MS = 60
const MULLIGAN_FLIGHT_MS = 340

function faceDownCard(id: string): CardView {
  return { id, name: 'Magic Card', manaValue: 0, expansionSetCode: '', cardNumber: '0', faceDown: true }
}

/**
 * The server sends an opponent's hand only as a count, and a mulligan leaves it the same: a few
 * face-down cards go back from their hand to their library and a fresh hand is dealt back.
 */
export function animateOpponentMulligan(playerId: string): void {
  if (!fxMotionAllowed() || typeof document === 'undefined') return
  afterLayout(() => {
    const seat = `[data-player-id="${playerId}"]`
    const library = visibleRect(document.querySelector(`${seat} :is(.library-stack, .library-chip, .pile-card--library)`))
    const fanCards = Array.from(document.querySelectorAll<HTMLElement>(`${seat} .hand-back-fan-card`))
    const handEl =
      document.querySelector<HTMLElement>(`${seat} .hand-back-fan`)
      ?? document.querySelector<HTMLElement>(`${seat} .hand-back-stack`)
      ?? document.querySelector<HTMLElement>(`${seat} .hand-zone`)
      ?? document.querySelector<HTMLElement>(`.player-info-bar${seat} .pp-hand-badge`)
      ?? document.querySelector<HTMLElement>(`.player-info-bar${seat}`)
    const hand = visibleRect(handEl)
    if (!library || !hand) return
    const ms = fxMotionDuration(MULLIGAN_FLIGHT_MS)
    const stamp = Date.now()
    const isInvertedFan = Boolean(handEl?.closest('.hand-back-stack.is-half-fan') || handEl?.classList.contains('is-half-fan'))
    const count = fanCards.length > 0 ? Math.min(fanCards.length, 6) : MULLIGAN_CARDS
    const pileCardSize = { w: 44, h: 62 }

    for (let i = 0; i < count; i++) {
      const fanEl = fanCards[i] ?? null
      const cardRect = visibleRect(fanEl) ?? hand
      const fanDeg = fanEl ? parseFloat(getComputedStyle(fanEl).getPropertyValue('--fan-rot')) || 0 : 0
      const startRotation = isInvertedFan ? 180 + fanDeg : fanDeg
      const out = faceDownCard(`mulligan-out-${playerId}-${stamp}-${i}`)
      const back = faceDownCard(`mulligan-in-${playerId}-${stamp}-${i}`)
      const fanSelector = fanEl ? `${seat} .hand-back-fan-card:nth-child(${i + 1})` : undefined

      setTimeout(() => {
        if (fanEl) fanEl.style.opacity = '0'
        startCardFlight(out, cardRect, library, ms, undefined, {
          sourceSize: fanEl ? { w: 52, h: 73 } : pileCardSize,
          startRotation,
        })
      }, i * MULLIGAN_STAGGER_MS)

      setTimeout(() => {
        const destRect = visibleRect(fanEl) ?? hand
        const flightId = startCardFlight(back, library, destRect, ms, fanSelector, {
          sourceSize: pileCardSize,
        })
        if (fanEl) {
          if (flightId) {
            onFlightLanded(flightId, () => {
              fanEl.style.opacity = ''
            })
          } else {
            fanEl.style.opacity = ''
          }
        }
      }, ms + 160 + i * MULLIGAN_STAGGER_MS)
    }

    // Safety net: ensure opponent hand cards are never left invisible if a flight is skipped.
    setTimeout(() => {
      fanCards.forEach((el) => { el.style.opacity = '' })
    }, ms * 2 + 240 + count * MULLIGAN_STAGGER_MS)
  })
}

/** Scry / surveil: the library peek overlay (`libraryPeekFx.ts`); cards surveilled into the graveyard then fly there through the ordinary zone diff. */
export function animateLibraryPeek(playerId: string, amount: number): void {
  spawnLibraryPeek(playerId, amount)
}

/**
 * Game-log hook for the effects the `GameView` cannot show: a flicker (same id in and out), a
 * sacrifice (looks like a destroy in the diff), an opponent's mulligan (hand count unchanged), scry /
 * surveil (the library peek), dice rolls (never in the view), a fizzle, a behold, a concession,
 * paying or declining to prevent an effect, a chosen value and a completed dungeon.
 */
export function sniffGameLogFx(message: string, gameId: string | null | undefined): void {
  if (!gameId) return
  const s = getState()
  if (s.gameId !== gameId) return
  sniffDiceRoll(message, gameId)
  sniffFizzle(message, gameId)
  sniffBehold(message, gameId)
  sniffConcede(message, gameId)
  sniffPlayerLogFx(message, gameId)
  const sacrifice = parseSacrifice(message)
  if (sacrifice) {
    noteSacrificed(sacrifice.objectId)
    return
  }
  const flicker = parseFlicker(message)
  if (flicker) {
    const players = s.game?.players ?? []
    const wasOnBattlefield = players.some((p) => flicker.objectId in (p.battlefield ?? {}))
    const wasInExile = players.some((p) => flicker.objectId in (p.exile ?? {}))
    if (wasOnBattlefield && !wasInExile) flickerPermanent(flicker.objectId)
    return
  }
  const peek = parseLibraryPeek(message)
  if (peek) {
    const named = peek.player.toLowerCase()
    const player = s.game?.players?.find((p) => p.name.trim().toLowerCase() === named)
    if (player) animateLibraryPeek(player.playerId, peek.amount)
    return
  }
  const mulligan = parseMulligan(message)
  if (mulligan) {
    const named = mulligan.player.toLowerCase()
    const player = s.game?.players?.find((p) => p.name.trim().toLowerCase() === named)
    if (player && player.controlled !== true) animateOpponentMulligan(player.playerId)
  }
}
