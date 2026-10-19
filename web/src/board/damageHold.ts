import { useRef, useSyncExternalStore } from 'react'
import type { GameView, PermanentView, PlayerView } from '../net/types'
import { stackTargetIds } from './stackEntries'

/**
 * Life and damage that a spell has not dealt on screen yet. The game state already carries the
 * hit when the spell leaves the stack, so the display keeps the value from before the hit until
 * the spell's projectile lands on its target (see `releaseHeldHit`).
 */
const held = new Map<string, number>()
const listeners = new Set<() => void>()
let heldVersion = 0
let cache: { raw: GameView; version: number; out: GameView } | null = null

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

function lifeKey(playerId: string) {
  return `life:${playerId}`
}

function damageKey(permanentId: string) {
  return `damage:${permanentId}`
}

function hold(key: string, value: number) {
  if (held.has(key)) return
  held.set(key, value)
  heldVersion++
}

function permanentsOf(game: GameView): Array<[string, PermanentView]> {
  return (game.players ?? []).flatMap((p) => Object.entries(p.battlefield ?? {}) as Array<[string, PermanentView]>)
}

function damageOf(perm: PermanentView | undefined): number {
  return typeof (perm as { damage?: number } | undefined)?.damage === 'number' ? (perm as { damage: number }).damage : 0
}

/** Holds the values a spell leaving the stack is about to change on its targets. */
function holdPendingHits(prev: GameView, next: GameView) {
  const prevPermanents = new Map(permanentsOf(prev))
  const nextPermanents = new Map(permanentsOf(next))
  for (const [spellId, spell] of Object.entries(prev.stack ?? {})) {
    if (spellId in (next.stack ?? {})) continue
    for (const targetId of stackTargetIds(spell)) {
      const prevPlayer: PlayerView | undefined = prev.players?.find((p) => p.playerId === targetId)
      const nextPlayer: PlayerView | undefined = next.players?.find((p) => p.playerId === targetId)
      if (prevPlayer && nextPlayer && (nextPlayer.life ?? 0) < (prevPlayer.life ?? 0)) {
        hold(lifeKey(targetId), prevPlayer.life ?? 0)
      }
      if (prevPermanents.has(targetId) && damageOf(nextPermanents.get(targetId)) > damageOf(prevPermanents.get(targetId))) {
        hold(damageKey(targetId), damageOf(prevPermanents.get(targetId)))
      }
    }
  }
}

function overlay(raw: GameView): GameView {
  const players = (raw.players ?? []).map((p) => {
    const life = held.get(lifeKey(p.playerId))
    const battlefield = Object.fromEntries(
      Object.entries(p.battlefield ?? {}).map(([id, perm]) => {
        const damage = held.get(damageKey(id))
        return [id, damage === undefined ? perm : { ...perm, damage }]
      }),
    )
    return { ...p, ...(life === undefined ? {} : { life }), battlefield }
  })
  return { ...raw, players }
}

/** The view to draw: the raw game with every held hit put back to its pre-hit value. */
export function displayedGame(raw: GameView): GameView {
  if (held.size === 0) return raw
  if (cache && cache.raw === raw && cache.version === heldVersion) return cache.out
  const out = overlay(raw)
  cache = { raw, version: heldVersion, out }
  return out
}

/** The projectiles aimed at `targetId` have all landed: its hit is shown now. */
export function releaseHeldHit(targetId: string) {
  const life = held.delete(lifeKey(targetId))
  const damage = held.delete(damageKey(targetId))
  if (!life && !damage) return
  heldVersion++
  listeners.forEach((fn) => fn())
}

/**
 * The game as it is drawn. A frozen view (rewind) is drawn as it is and creates no holds,
 * because no projectile of a rewound view will land to release them.
 */
export function useDisplayedGame(game: GameView | null, gameId: string | null, frozen: boolean): GameView | null {
  const prevRef = useRef<GameView | null>(null)
  const gameIdRef = useRef<string | null>(gameId)
  if (!game || frozen || gameIdRef.current !== gameId) {
    if (gameIdRef.current !== gameId || !game) {
      held.clear()
      heldVersion++
    }
    gameIdRef.current = gameId
    prevRef.current = null
  } else {
    if (prevRef.current && prevRef.current !== game) holdPendingHits(prevRef.current, game)
    prevRef.current = game
  }
  useSyncExternalStore(subscribe, () => heldVersion, () => heldVersion)
  return game && !frozen ? displayedGame(game) : game
}
