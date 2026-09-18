import type { CardView, CardsView, GameView, PlayerView } from '../net/types'
import { stripTags } from '../utils/textRefs'

export interface DayNightState {
  isNight: boolean
  hint: string
}

const CURRENT_RE = /it'?s currently (day|night)/i
const NEITHER_RE = /neither day nor night/i

export function dayNightHintOf(rules?: readonly string[] | null): DayNightState | null {
  if (!rules) return null
  for (const raw of rules) {
    if (typeof raw !== 'string') continue
    const line = stripTags(raw)
    const m = CURRENT_RE.exec(line)
    if (m) return { isNight: m[1].toLowerCase() === 'night', hint: line }
    if (NEITHER_RE.test(line)) return null
  }
  return null
}

function stateOfCard(card: CardView | null | undefined): DayNightState | null {
  if (!card || typeof card !== 'object') return null
  return dayNightHintOf(card.rules) ?? dayNightHintOf(card.secondCardFace?.rules)
}

function stateOfCards(cards: CardsView | null | undefined): DayNightState | null {
  if (!cards || typeof cards !== 'object') return null
  for (const card of Object.values(cards)) {
    const state = stateOfCard(card)
    if (state) return state
  }
  return null
}

function stateOfPlayer(player: PlayerView): DayNightState | null {
  for (const permanent of Object.values(player.battlefield ?? {})) {
    const state = stateOfCard(permanent)
    if (state) return state
  }
  return null
}

export function dayNightStateOf(game: GameView | null | undefined): DayNightState | null {
  if (!game) return null
  const helper = stateOfCards(game.myHelperEmblems)
  if (helper) return helper
  for (const player of game.players ?? []) {
    const state = stateOfPlayer(player)
    if (state) return state
  }
  return null
}

export function dayNightStateOfPlayer(
  player: PlayerView | null | undefined,
  game: GameView | null | undefined,
): DayNightState | null {
  if (!player) return null
  if (player.controlled) {
    const helper = stateOfCards(game?.myHelperEmblems)
    if (helper) return helper
  }
  return stateOfPlayer(player)
}
