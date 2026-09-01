import { useEffect, useRef } from 'react'
import type { CardView, GameView } from '../net/types'
import { startCardFlight, hasFlightFor } from './flightManager'
import { getPreviousCardPosition, clearCardPositionRegistry } from './cardPositionRegistry'

function getRect(selector: string): DOMRect | null {
  const el = document.querySelector(selector) as HTMLElement | null
  if (!el) return null
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  return rect
}

function getPlayerSelector(playerId?: string, playerName?: string): string {
  if (playerId && playerName) {
    return `:is([data-player-id="${playerId}"], [data-player-name="${playerName}"])`
  }
  if (playerId) return `[data-player-id="${playerId}"]`
  if (playerName) return `[data-player-name="${playerName}"]`
  return ''
}

/** Vuela solo si ninguna otra parte (CardSlot al montar) ya lanzó un vuelo
 *  para esta carta; evita clones duplicados y destinos contradictorios. */
function flyOnce(
  cardId: string,
  card: CardView,
  fromRect: DOMRect | null,
  toRect: DOMRect | null,
  duration: number
): void {
  if (!fromRect || !toRect) return
  if (hasFlightFor(cardId)) return
  startCardFlight(card, fromRect, toRect, duration)
}

function shakeElement(selector: string, ms = 420): void {
  const el = document.querySelector(selector)
  if (!el) return
  el.classList.remove('took-damage')
  void (el as HTMLElement).offsetWidth
  el.classList.add('took-damage')
  setTimeout(() => el.classList.remove('took-damage'), ms)
}

export function detectAndAnimateTransitions(prevGame: GameView, nextGame: GameView) {
  if (!prevGame || !nextGame) return
  const prevId = (prevGame as any).gameId ?? (prevGame as any).matchId
  const nextId = (nextGame as any).gameId ?? (nextGame as any).matchId
  if (prevId && nextId && prevId !== nextId) return

  const stackEl = document.querySelector('.stack-zone, .stack-list, .right-panel-content') as HTMLElement | null
  const stackRect = stackEl ? stackEl.getBoundingClientRect() : null

  // 1. Detect New Spells on the Stack (Hand/Battlefield -> Stack)
  const prevStack = prevGame.stack ?? {}
  const nextStack = nextGame.stack ?? {}

  for (const [spellId, spell] of Object.entries(nextStack)) {
    if (!(spellId in prevStack)) {
      const ctrlId = spell.controllerId ?? spell.sourceCard?.controllerId
      const ctrlName = spell.controllerName ?? spell.sourceCard?.controllerName
      const pSel = getPlayerSelector(ctrlId, ctrlName)

      let sourceRect: DOMRect | null = null

      // 1a. Check cardPositionRegistry first (card just unmounted from hand/battlefield)
      const srcId = spell.sourceCard?.id ?? spell.id
      if (srcId) {
        sourceRect = getPreviousCardPosition(srcId)
      }

      // 1b. Check if source card is still visible on battlefield
      if (!sourceRect && srcId) {
        sourceRect = getRect(`[data-card-id="${srcId}"]`)
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
        flyOnce(spellId, spell, sourceRect, stackRect, 380)
      }
    }
  }

  // 2. Detect Player-specific Transitions (Draws, Lands, Battlefield Resolves, Graveyard)
  const nextPlayers = nextGame.players ?? []
  const prevPlayers = prevGame.players ?? []

  for (const nextP of nextPlayers) {
    const prevP = prevPlayers.find((p) => p.playerId === nextP.playerId || p.name === nextP.name)
    if (!prevP) continue

    const pSel = getPlayerSelector(nextP.playerId, nextP.name)
    if (!pSel) continue

    const libRect = getRect(`${pSel} .library-stack`)
    const handRect = getRect(`${pSel} .hand-zone`)
    const graveRect = getRect(`${pSel} .graveyard-stack`)

    // A) Card Draws (Library -> Hand)
    // Use real hand IDs when available (controlled player), else fall back to handCount delta
    const isControlled = nextP.controlled === true
    if (isControlled) {
      const prevHand = prevGame.myHand ?? {}
      const nextHand = nextGame.myHand ?? {}
      const drawnIds = Object.keys(nextHand).filter((id) => !(id in prevHand))
      if (drawnIds.length > 0 && libRect && handRect) {
        const capped = drawnIds.slice(0, 3)
        capped.forEach((id, i) => {
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
            flyOnce(id, dummyCard, libRect, handRect, 320)
          }, i * 70)
        })
      }
    } else {
      const prevHandCount = prevP.handCount ?? 0
      const nextHandCount = nextP.handCount ?? 0
      if (nextHandCount > prevHandCount && libRect && handRect) {
        const drawnCount = Math.min(3, nextHandCount - prevHandCount)
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
            flyOnce(drawnId, dummyCard, libRect, handRect, 320)
          }, i * 70)
        }
      }
    }

    // B) Permanent Enters Battlefield (Stack -> Battlefield, or Hand -> Battlefield for Lands)
    const prevBattlefield = prevP.battlefield ?? {}
    const nextBattlefield = nextP.battlefield ?? {}

    for (const [permId, perm] of Object.entries(nextBattlefield)) {
      if (!(permId in prevBattlefield)) {
        const wasInStack = permId in prevStack || (perm.parentId && perm.parentId in prevStack)

        let originRect: DOMRect | null = null

        // Check registry first: card may have just unmounted from hand/stack
        const prevRegistered = getPreviousCardPosition(permId)
        if (prevRegistered) {
          originRect = prevRegistered
        } else if (wasInStack) {
          originRect = stackRect
        } else {
          originRect = handRect
        }

        if (originRect) {
          requestAnimationFrame(() => {
            const destRect =
              getRect(`[data-card-id="${permId}"]`) ||
              getRect(`${pSel} .creatures-band`) ||
              getRect(`${pSel} .permanents-band`)

            if (destRect) {
              flyOnce(permId, perm, originRect, destRect, 350)
            }
          })
        }
      }
    }

    // C) Permanent Leaves Battlefield -> Graveyard (Dies)
    for (const [permId, perm] of Object.entries(prevBattlefield)) {
      if (!(permId in nextBattlefield) && graveRect) {
        const prevCardRect = getPreviousCardPosition(permId) ?? getRect(`[data-card-id="${permId}"]`)
        if (prevCardRect) {
          flyOnce(permId, perm, prevCardRect, graveRect, 350)
        }
      }
    }

    // D) Combat/ability damage feedback: creatures and players that lost life shake
    for (const [permId, nextPerm] of Object.entries(nextBattlefield)) {
      const prevPerm = prevBattlefield[permId] as { damage?: number } | undefined
      const prevDamage = typeof prevPerm?.damage === 'number' ? prevPerm.damage : 0
      const nextDamage = typeof (nextPerm as { damage?: number }).damage === 'number'
        ? (nextPerm as { damage?: number }).damage ?? 0
        : 0
      if (nextDamage > prevDamage) {
        shakeElement(`[data-card-id="${permId}"]`)
      }
    }

    if ((nextP.life ?? 0) < (prevP.life ?? 0)) {
      const playerEls = Array.from(document.querySelectorAll(`[data-player-id="${nextP.playerId}"]`))
      const deepest = playerEls.reduce<Element | null>((acc, el) => (!acc || acc.contains(el) ? el : acc), null)
      if (deepest) {
        deepest.classList.remove('took-damage')
        void (deepest as HTMLElement).offsetWidth
        deepest.classList.add('took-damage')
        setTimeout(() => deepest.classList.remove('took-damage'), 420)
      }
    }
  }
}

export function useGameTransitions(game: GameView | null) {
  const prevGameRef = useRef<GameView | null>(null)

  useEffect(() => {
    if (!game) {
      prevGameRef.current = null
      return
    }

    const gameId = (game as any).gameId ?? (game as any).matchId ?? null
    const prevGame = prevGameRef.current
    if (prevGame) {
      const prevId = (prevGame as any).gameId ?? (prevGame as any).matchId ?? null
      if (gameId && prevId && gameId !== prevId) {
        clearCardPositionRegistry()
      } else {
        detectAndAnimateTransitions(prevGame, game)
      }
    }

    prevGameRef.current = game
  }, [game])
}
