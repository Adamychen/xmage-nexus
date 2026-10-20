import type { CardView, GameView, PlayerView } from '../net/types'
import type { CardSourceSize } from './cardPositionRegistry'
import { commandZoneCommanders } from './commanders'
import { isAbilityCard } from '../cards/cardImages'

/** A commander's flight to its command zone. */
export const COMMAND_FLIGHT_MS = 760
const PRIMED_MS = 1500
const PILE_CARD: CardSourceSize = { w: 44, h: 62 }

export type CommandOrigin = 'battlefield' | 'graveyard' | 'exile' | 'hand'

export interface CommandReturn {
  id: string
  playerId: string
  origin: CommandOrigin
  card: CardView
}

function samePlayer(a: PlayerView, b: PlayerView): boolean {
  return a.playerId === b.playerId || a.name === b.name
}

/**
 * Commanders that went back to their command zone in this update: each is in the command zone now,
 * was not before, and was on a battlefield, in its owner's graveyard or exile, or in my hand. A
 * commander coming back from a hidden zone (an opponent's hand, a library) is left out: there is no
 * place to fly it from.
 */
export function commanderReturns(prevGame: GameView | null | undefined, nextGame: GameView | null | undefined): CommandReturn[] {
  if (!prevGame || !nextGame) return []
  const onField = new Set((prevGame.players ?? []).flatMap((p) => Object.keys(p.battlefield ?? {})))
  const out: CommandReturn[] = []
  for (const nextP of nextGame.players ?? []) {
    const prevP = (prevGame.players ?? []).find((p) => samePlayer(p, nextP))
    if (!prevP) continue
    const before = commandZoneCommanders(prevP)
    for (const [id, card] of commandZoneCommanders(nextP)) {
      if (before.has(id)) continue
      const origin: CommandOrigin | null = onField.has(id)
        ? 'battlefield'
        : id in (prevP.graveyard ?? {})
          ? 'graveyard'
          : id in (prevP.exile ?? {})
            ? 'exile'
            : prevP.controlled === true && id in (prevGame.myHand ?? {}) ? 'hand' : null
      if (origin) out.push({ id, playerId: nextP.playerId, origin, card })
    }
  }
  return out
}

/**
 * The commander a new stack spell was cast from the command zone as: the commander left its
 * controller's command zone in this update and the spell is it (same id, or the same name, since
 * a spell on the stack has an id of its own).
 */
export function castFromCommand(spell: CardView, spellId: string, prevGame: GameView, nextGame: GameView): string | null {
  if (spell.isAbility === true || isAbilityCard(spell)) return null
  const ctrlId = spell.controllerId ?? spell.sourceCard?.controllerId
  const ctrlName = spell.controllerName ?? spell.sourceCard?.controllerName
  const matches = (p: PlayerView) => (ctrlId ? p.playerId === ctrlId : p.name === ctrlName)
  const prevCtrl = (prevGame.players ?? []).find(matches)
  if (!prevCtrl) return null
  const before = commandZoneCommanders(prevCtrl)
  const after = commandZoneCommanders((nextGame.players ?? []).find(matches))
  const left = [...before].filter(([id]) => !after.has(id))
  const ids = [spellId, spell.sourceCard?.id]
  return left.find(([id]) => ids.includes(id))?.[0] ?? left.find(([, card]) => card.name === spell.name)?.[0] ?? null
}

const BATTLEFIELD_SKIP = '.stack-zone, .stack-deck, .stack-list, .command-zone'

function playerSelector(player: PlayerView): string {
  return `:is([data-player-id="${player.playerId}"], [data-player-name="${player.name}"])`
}

function measured(el: Element | null | undefined): DOMRect | null {
  const rect = el?.getBoundingClientRect()
  return rect && rect.width > 0 && rect.height > 0 ? rect : null
}

/** Where a returning commander is drawn in the view that is still on screen. */
function originOf(ret: CommandReturn, prevGame: GameView): { rect: DOMRect; size: CardSourceSize | null } | null {
  if (ret.origin === 'battlefield' || ret.origin === 'hand') {
    const slot = [...document.querySelectorAll<HTMLElement>(`.card-slot[data-card-id="${ret.id}"]`)].find((el) => !el.closest(BATTLEFIELD_SKIP))
    const rect = measured(slot)
    if (!rect || !slot) return null
    const tapped = slot.classList.contains('tapped')
    return { rect, size: tapped ? null : { w: slot.offsetWidth, h: slot.offsetHeight, compact: slot.classList.contains('is-compact') } }
  }
  const owner = (prevGame.players ?? []).find((p) => p.playerId === ret.playerId)
  if (!owner) return null
  const pile = ret.origin === 'graveyard' ? ':is(.graveyard-stack, .graveyard-chip)' : ':is(.exile-stack, .exile-chip)'
  const rect = measured(document.querySelector(`${playerSelector(owner)} ${pile}`))
  if (!rect) return null
  return { rect, size: rect.width / rect.height > 1.05 ? PILE_CARD : null }
}

const primed = new Map<string, { rect: DOMRect; size: CardSourceSize | null; until: number }>()

/**
 * Read while the update renders, before the view on screen changes: where each returning commander
 * was, so its command-zone slot can fly in from there instead of just appearing.
 */
export function primeCommandReturns(prevGame: GameView | null | undefined, nextGame: GameView | null | undefined): void {
  if (!prevGame || !nextGame || typeof document === 'undefined') return
  const until = Date.now() + PRIMED_MS
  for (const ret of commanderReturns(prevGame, nextGame)) {
    const origin = originOf(ret, prevGame)
    if (origin) primed.set(ret.id, { ...origin, until })
  }
}

/** Where a commander that just went back to the command zone came from, or null when it did not. */
export function commandReturnSource(id: string | null | undefined): { rect: DOMRect; size: CardSourceSize | null } | null {
  if (!id) return null
  const entry = primed.get(id)
  if (!entry) return null
  if (entry.until < Date.now()) {
    primed.delete(id)
    return null
  }
  return { rect: entry.rect, size: entry.size }
}

export function clearCommandReturns(): void {
  primed.clear()
}
