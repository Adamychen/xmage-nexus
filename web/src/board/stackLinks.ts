import type { CardView, GameView, PlayerView } from '../net/types'
import { isAbilityCard } from '../cards/cardImages'
import { recordCardPosition, type CardSourceSize } from './cardPositionRegistry'

export type StackDestination = 'battlefield' | 'graveyard' | 'exile'

export interface StackDeparture {
  /** The id the card has where it went: the server keys a spell on the stack by its spell ability id, not its card id. */
  cardId: string
  zone: StackDestination
  playerId: string
}

type Zone = Record<string, CardView> | undefined

function zoneOf(player: PlayerView, zone: StackDestination): Zone {
  return zone === 'battlefield' ? player.battlefield : zone === 'graveyard' ? player.graveyard : player.exile
}

function isSpell(card: CardView): boolean {
  return card.isAbility !== true && !isAbilityCard(card)
}

function controllerOf(card: CardView): { id?: string; name?: string } {
  return { id: card.controllerId ?? card.sourceCard?.controllerId, name: card.controllerName ?? card.sourceCard?.controllerName }
}

function isController(player: PlayerView, card: CardView): boolean {
  const ctrl = controllerOf(card)
  return ctrl.id ? player.playerId === ctrl.id : !!ctrl.name && player.name === ctrl.name
}

function sameCard(a: CardView, b: CardView): boolean {
  if (a.name && a.name === b.name) return true
  return !!a.expansionSetCode && a.expansionSetCode === b.expansionSetCode && !!a.cardNumber && a.cardNumber === b.cardNumber
}

function ownIds(spellId: string, spell: CardView): string[] {
  return [spellId, spell.sourceCard?.id, spell.parentId].filter((id): id is string => !!id)
}

const DESTINATIONS: StackDestination[] = ['battlefield', 'graveyard', 'exile']

/**
 * Where each spell that left the stack in this update went: the battlefield it resolved onto, or
 * the graveyard or exile it fell into. A spell on the stack has an id of its own (its spell ability's),
 * so the card is found by that id, its source card's or its parent's when the view carries one, and
 * otherwise as a card of the same name (or printing) new to that zone, its controller's first.
 */
export function stackDepartures(prevGame: GameView | null | undefined, nextGame: GameView | null | undefined): Map<string, StackDeparture> {
  const out = new Map<string, StackDeparture>()
  if (!prevGame || !nextGame) return out
  const prevStack = prevGame.stack ?? {}
  const nextStack = nextGame.stack ?? {}
  const departed = Object.entries(prevStack).filter(([id, spell]) => !(id in nextStack) && spell && isSpell(spell))
  if (departed.length === 0) return out
  const players = nextGame.players ?? []
  const prevPlayers = prevGame.players ?? []
  const prevBattlefield = new Set(prevPlayers.flatMap((p) => Object.keys(p.battlefield ?? {})))
  const claimed = new Set<string>()
  const pending: Array<[string, CardView]> = []
  for (const [spellId, spell] of departed) {
    const ids = ownIds(spellId, spell)
    let found: StackDeparture | null = null
    for (const zone of DESTINATIONS) {
      for (const p of players) {
        const cards = zoneOf(p, zone) ?? {}
        const cardId = ids.find((id) => id in cards)
          ?? (zone === 'battlefield' ? Object.keys(cards).find((id) => cards[id]?.parentId === spellId) : undefined)
        if (cardId && !claimed.has(cardId)) {
          found = { cardId, zone, playerId: p.playerId }
          break
        }
      }
      if (found) break
    }
    if (found) {
      claimed.add(found.cardId)
      out.set(spellId, found)
    } else {
      pending.push([spellId, spell])
    }
  }
  for (const [spellId, spell] of pending) {
    const ordered = [...players.filter((p) => isController(p, spell)), ...players.filter((p) => !isController(p, spell))]
    let found: StackDeparture | null = null
    for (const zone of DESTINATIONS) {
      for (const p of ordered) {
        const prevP = prevPlayers.find((q) => q.playerId === p.playerId)
        const before = zone === 'battlefield' ? null : zoneOf(prevP ?? p, zone) ?? {}
        const entry = Object.entries(zoneOf(p, zone) ?? {}).find(([id, card]) => card && !claimed.has(id)
          && (before ? !(id in before) : !prevBattlefield.has(id)) && sameCard(card, spell))
        if (entry) {
          found = { cardId: entry[0], zone, playerId: p.playerId }
          break
        }
      }
      if (found) break
    }
    if (found) {
      claimed.add(found.cardId)
      out.set(spellId, found)
    }
  }
  return out
}

/** The ids of the cards the departed spells became in one zone. */
export function departureIds(departures: Map<string, StackDeparture>, zone: StackDestination): Set<string> {
  return new Set([...departures.values()].filter((d) => d.zone === zone).map((d) => d.cardId))
}

export type CastOrigin = 'hand' | 'graveyard' | 'exile'

/**
 * The card a new stack spell was cast from, with the zone it left: the spell's own id (or its source
 * card's) when its controller had it in my hand, their graveyard or exile, otherwise a card of the
 * same name that left one of those zones in this update.
 */
export function castCard(spellId: string, spell: CardView, prevGame: GameView, nextGame?: GameView | null): { id: string; zone: CastOrigin } | null {
  if (!isSpell(spell)) return null
  const prevCtrl = (prevGame.players ?? []).find((p) => isController(p, spell))
  if (!prevCtrl) return null
  const nextCtrl = (nextGame?.players ?? []).find((p) => p.playerId === prevCtrl.playerId)
  const zones: Array<[CastOrigin, Zone, Zone]> = [
    ['hand', prevCtrl.controlled === true ? prevGame.myHand : undefined, nextGame?.myHand],
    ['graveyard', prevCtrl.graveyard, nextCtrl?.graveyard],
    ['exile', prevCtrl.exile, nextCtrl?.exile],
  ]
  const ids = ownIds(spellId, spell)
  for (const [zone, cards] of zones) {
    const id = ids.find((x) => x in (cards ?? {}))
    if (id) return { id, zone }
  }
  if (!nextGame) return null
  for (const [zone, cards, after] of zones) {
    const entry = Object.entries(cards ?? {}).find(([id, card]) => card && !(id in (after ?? {})) && sameCard(card, spell))
    if (entry) return { id: entry[0], zone }
  }
  return null
}

const STACK_SELECTOR = '.stack-zone, .stack-deck, .stack-list'

/**
 * Where a spell is drawn right now: its large top card or its tab. Read when the spell resolves,
 * because its position was recorded before it became the top card and is stale by then.
 */
export function stackSpellSource(spellId: string): { rect: DOMRect; size: CardSourceSize } | null {
  if (typeof document === 'undefined') return null
  const shown = [...document.querySelectorAll<HTMLElement>(`[data-card-id="${spellId}"]`)].find((el) => el.closest(STACK_SELECTOR))
  const el = (document.querySelector<HTMLElement>(`[data-card-id="${spellId}"] .stack-thumb`) ?? shown ?? document.querySelector<HTMLElement>(`[data-card-id="${spellId}"]`))
  if (!el) return null
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  return { rect, size: { w: el.offsetWidth, h: el.offsetHeight } }
}

/**
 * Read while the update renders, before the view on screen changes: every permanent spell resolving
 * onto the battlefield is recorded where its spell is drawn on the stack, under the id the permanent
 * has, so its slot flies in from the stack and not from the hand it was cast from.
 */
export function primeStackEntries(prevGame: GameView | null | undefined, nextGame: GameView | null | undefined): void {
  if (!prevGame || !nextGame || typeof document === 'undefined') return
  for (const [spellId, departure] of stackDepartures(prevGame, nextGame)) {
    if (departure.zone !== 'battlefield') continue
    const source = stackSpellSource(spellId)
    if (source) recordCardPosition(departure.cardId, source.rect, 'stack-zone', source.size)
  }
}
