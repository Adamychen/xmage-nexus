import { useEffect, useRef } from 'react'
import type { CardView, GameView } from '../net/types'
import { startCardFlight } from './flightManager'

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

      // Find source rect
      let sourceRect: DOMRect | null = null

      // Check if source card was on battlefield
      const srcId = spell.sourceCard?.id
      if (srcId) {
        sourceRect = getRect(`[data-card-id="${srcId}"]`)
      }

      // If not on battlefield, check player's hand
      if (!sourceRect && pSel) {
        sourceRect = getRect(`${pSel} .hand-zone`)
      }

      // Fallback: player zone
      if (!sourceRect && pSel) {
        sourceRect = getRect(pSel)
      }

      if (sourceRect && stackRect) {
        startCardFlight(spell, sourceRect, stackRect, 380)
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
    const prevHandCount = prevP.handCount ?? 0
    const nextHandCount = nextP.handCount ?? 0
    if (nextHandCount > prevHandCount && libRect && handRect) {
      const drawnCount = Math.min(3, nextHandCount - prevHandCount)
      for (let i = 0; i < drawnCount; i++) {
        const dummyCard: CardView = {
          id: `draw-${nextP.playerId}-${Date.now()}-${i}`,
          name: 'Magic Card',
          manaValue: 0,
          expansionSetCode: '',
          cardNumber: '0',
          faceDown: true,
        }
        setTimeout(() => {
          startCardFlight(dummyCard, libRect, handRect, 320)
        }, i * 70)
      }
    }

    // B) Permanent Enters Battlefield (Stack -> Battlefield, or Hand -> Battlefield for Lands)
    const prevBattlefield = prevP.battlefield ?? {}
    const nextBattlefield = nextP.battlefield ?? {}

    for (const [permId, perm] of Object.entries(nextBattlefield)) {
      if (!(permId in prevBattlefield)) {
        // Find if it resolved from stack or was played from hand
        const wasInStack = permId in prevStack || (perm.parentId && perm.parentId in prevStack)
        const originRect = wasInStack ? stackRect : handRect

        if (originRect) {
          // Defer slightly until destination DOM slot mounts
          requestAnimationFrame(() => {
            const destRect =
              getRect(`[data-card-id="${permId}"]`) ||
              getRect(`${pSel} .creatures-band`) ||
              getRect(`${pSel} .permanents-band`)

            if (destRect) {
              startCardFlight(perm, originRect, destRect, 350)
            }
          })
        }
      }
    }

    // C) Permanent Leaves Battlefield -> Graveyard (Dies)
    for (const [permId, perm] of Object.entries(prevBattlefield)) {
      if (!(permId in nextBattlefield) && graveRect) {
        const prevCardRect = getRect(`[data-card-id="${permId}"]`)
        if (prevCardRect) {
          startCardFlight(perm, prevCardRect, graveRect, 350)
        }
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

    if (prevGameRef.current) {
      detectAndAnimateTransitions(prevGameRef.current, game)
    }

    prevGameRef.current = game
  }, [game])
}
