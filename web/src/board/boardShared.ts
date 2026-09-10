import { useMemo } from 'react'
import type { CardView, GameView, PermanentView, PlayerView } from '../net/types'
import { simpleToCardsView } from './revealedCards'
import type { CrossZonePlayable } from './crossZone'

export const MAX_BOARD_PLAYERS = 4

export interface BoardProps {
  game: GameView | null
  targetIds?: string[]
  chosenTargetIds?: string[]
  onTargetClick?: (id: string) => void
  playableIds?: string[]
  onPlayableClick?: (id: string) => void
  onCardHover?: (card: CardView | null) => void
  combatSelectable?: string[]
  combatMode?: 'attack' | 'block' | null
  combatChosen?: string[]
  onCombatClick?: (id: string) => void
  attackingIds?: string[]
  blockingIds?: string[]
  crossZonePlayables?: CrossZonePlayable[]
  onPlayCrossZone?: (id: string) => void
}

export function useSpectatorBottomHand(
  game: GameView | null,
  isSpectator: boolean,
  bottomPlayer: PlayerView | undefined,
): Record<string, CardView> {
  return useMemo(() => {
    if (!isSpectator || !bottomPlayer) return {}
    const watched =
      game?.watchedHands?.[bottomPlayer.name] ||
      game?.watchedHands?.[bottomPlayer.playerId]
    const oppHand =
      game?.opponentHands?.[bottomPlayer.playerId] ||
      game?.opponentHands?.[bottomPlayer.name]
    if (watched) return simpleToCardsView(watched)
    if (oppHand) return simpleToCardsView(oppHand)
    return {}
  }, [isSpectator, bottomPlayer, game?.watchedHands, game?.opponentHands])
}

const PERMANENT_ONLY_FIELDS = [
  'tapped',
  'damage',
  'summoningSickness',
  'attachments',
  'morphed',
  'disguised',
  'manifested',
  'cloaked',
  'mutated',
  'attachedTo',
] as const

/** El servidor no serializa `zone` (las vistas de zona se crean con
 *  storeZone=false), así que "¿era un permanente en campo?" se deduce de los
 *  campos que solo existen en PermanentView: mano/cementerio/exilio/pila son
 *  CardView planos y nunca los traen. */
export function looksLikeBattlefieldPermanent(card: unknown): boolean {
  if (!card || typeof card !== 'object') return false
  const rec = card as Record<string, unknown>
  return PERMANENT_ONLY_FIELDS.some((k) => rec[k] != null)
}

export interface GameCardHit {
  view: CardView | PermanentView
  inBattlefield: boolean
}

function cardsMapHit(map: unknown, id: string): CardView | PermanentView | null {
  if (!map) return null
  if (Array.isArray(map)) {
    for (const c of map) {
      if (c && typeof c === 'object' && (c as { id?: string }).id === id) return c as CardView
    }
    return null
  }
  if (typeof map !== 'object') return null
  const hit = (map as Record<string, unknown>)[id]
  return hit && typeof hit === 'object' ? (hit as CardView | PermanentView) : null
}

function commandListHit(cmd: unknown, id: string): CardView | PermanentView | null {
  if (Array.isArray(cmd)) {
    const hit = (cmd as Array<{ id?: string } | null>).find(
      (c) => c && typeof c === 'object' && c.id === id,
    )
    return (hit as CardView | undefined) ?? null
  }
  if (cmd && typeof cmd === 'object') return cardsMapHit(cmd, id)
  return null
}

/** Busca un id de carta en todas las zonas del GameView (pila, mano, campo,
 *  cementerio, exilio, sideboard, manos rivales/vistas, reveladas, emblemas).
 *  Prioriza el campo de batalla: es la vista más fresca para un permanente
 *  con hover activo. Devuelve null si el id ya no existe en la partida. */
export function findCardViewInGame(game: GameView | null, id: string): GameCardHit | null {
  if (!game || !id) return null
  const players = game.players ?? []
  for (const p of players) {
    const view = (p.battlefield as Record<string, PermanentView> | undefined)?.[id]
    if (view) return { view, inBattlefield: true }
  }
  const stackHit = cardsMapHit(game.stack, id)
  if (stackHit) return { view: stackHit, inBattlefield: false }
  const handHit = cardsMapHit(game.myHand, id)
  if (handHit) return { view: handHit, inBattlefield: false }
  for (const p of players) {
    for (const map of [p.graveyard, p.exile, p.sideboard, p.helperCards]) {
      const hit = cardsMapHit(map, id)
      if (hit) return { view: hit, inBattlefield: false }
    }
    if (p.topCard?.id === id) return { view: p.topCard, inBattlefield: false }
    const cmdHit = commandListHit(p.commandList, id)
    if (cmdHit) return { view: cmdHit, inBattlefield: false }
  }
  for (const hands of [game.opponentHands, game.watchedHands]) {
    for (const hand of Object.values(hands ?? {})) {
      const hit = cardsMapHit(hand, id)
      if (hit) return { view: hit as unknown as CardView, inBattlefield: false }
    }
  }
  for (const zone of [game.revealed, game.lookedAt, game.companion]) {
    for (const rv of zone ?? []) {
      const hit = cardsMapHit(rv?.cards, id)
      if (hit) return { view: hit, inBattlefield: false }
    }
  }
  for (const ex of game.exiles ?? []) {
    const hit = cardsMapHit(ex?.cards, id)
    if (hit) return { view: hit, inBattlefield: false }
  }
  const emblemHit = cardsMapHit(game.myHelperEmblems, id)
  if (emblemHit) return { view: emblemHit, inBattlefield: false }
  return null
}
