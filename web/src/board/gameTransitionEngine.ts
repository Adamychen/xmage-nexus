import { useEffect, useRef } from 'react'
import type { CardView, GameView } from '../net/types'
import { startCardFlight, noteFlightEvent } from './flightManager'
import { getPreviousCardPosition, getPreviousCardSize, clearCardPositionRegistry, type CardSourceSize } from './cardPositionRegistry'
import { announceBanner, spawnFloater } from './feedbackFx'
import { stringList } from '../state/gameUtils'
import { t } from '../i18n'

function getRect(selector: string): DOMRect | null {
  const el = document.querySelector(selector) as HTMLElement | null
  if (!el) return null
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  return rect
}

/** Resuelve el destino real probando selectores concretos (slot de la carta)
 *  antes de caer al rect del contenedor de zona. Devuelve también el selector
 *  que casó para poder re-medirlo en vuelo. */
function getDestRect(selectors: string[]): { rect: DOMRect; selector: string } | null {
  for (const selector of selectors) {
    const rect = getRect(selector)
    if (rect) return { rect, selector }
  }
  return null
}

/** Doble rAF: mide cuando React ha asentado el layout (p.ej. el fan de la mano
 *  recalcula overlap en su propio effect). Sin rAF (tests/jsdom), setTimeout. */
function scheduleAfterLayout(fn: () => void): void {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => requestAnimationFrame(fn))
  } else {
    setTimeout(fn, 34)
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
  sourceSize?: CardSourceSize | null
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
    startCardFlight(card, fromRect, toRect, duration, dest?.selector, { sourceSize })
  })
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

  // 0. Turn change → banner centrado con el jugador activo
  if (nextGame.turn !== prevGame.turn) {
    const active = nextGame.players?.find((p) => p.isActive)
    const playerName = active?.name ?? nextGame.activePlayerName ?? ''
    announceBanner(t('game', 'turn_banner_player', { turn: nextGame.turn, player: playerName }))
  }

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
      let sourceSize: CardSourceSize | null = null

      // 1a. Check cardPositionRegistry first (card just unmounted from hand/battlefield)
      const srcId = spell.sourceCard?.id ?? spell.id
      if (srcId) {
        const registered = getPreviousCardPosition(srcId)
        if (registered) {
          sourceRect = registered
          sourceSize = getPreviousCardSize(srcId)
        }
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
        flyAfterLayout(spellId, spell, sourceRect, [
          `[data-card-id="${spellId}"] .stack-thumb`,
          `[data-card-id="${spellId}"] .stack-tl-card`,
          `[data-card-id="${spellId}"]`,
        ], stackRect, 380, sourceSize)
      } else if (!sourceRect) {
        noteFlightEvent({ kind: 'skip', reason: 'no-source', cardId: spellId, detail: `stack-enter:${spell.name ?? ''}` })
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
    const graveRect = getRect(`${pSel} .graveyard-stack`)

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
            flyAfterLayout(id, dummyCard, libRect, [
              `[data-card-id="${id}"]`,
              '.hand-bar .hand-card-slot:last-child',
              `${pSel} .hand-zone .hand-card-slot:last-child`,
            ], handRect, 320)
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
            flyAfterLayout(drawnId, dummyCard, libRect, [
              `${pSel} .hand-zone .hand-card-slot:last-child`,
            ], handRect, 320)
          }, i * 70)
        }
      }
    }

    // G) Descartes y molino (-> cementerio sin pasar por el campo): la pila
    //    del cementerio actualiza su top in-place (sin montar slot), así que
    //    el camino A nunca dispara y hace falta vuelo del engine. Se excluyen
    //    las llegadas ya cubiertas por C (campo) y E (stack).
    const prevGraveIds = prevP.graveyard ?? {}
    const nextGraveIds = nextP.graveyard ?? {}
    const graveArrivals = Object.keys(nextGraveIds).filter((id) => !(id in prevGraveIds))
    if (graveArrivals.length > 0 && graveRect) {
      graveArrivals.slice(0, 3).forEach((id, i) => {
        if (id in (prevP.battlefield ?? {}) || id in prevStack) return
        const arrived = (nextGraveIds as Record<string, CardView>)[id]
        setTimeout(() => {
          const registered = getPreviousCardPosition(id)
          const originRect =
            registered ??
            getRect(`[data-card-id="${id}"]`) ??
            handRect ??
            libRect
          if (!originRect) {
            noteFlightEvent({ kind: 'skip', reason: 'no-source', cardId: id, detail: 'discard' })
            return
          }
          flyAfterLayout(id, arrived, originRect, [
            `${pSel} .graveyard-stack [data-card-id="${id}"]`,
            `${pSel} .graveyard-stack`,
          ], graveRect, 350, registered ? getPreviousCardSize(id) : null)
        }, i * 70)
      })
    }

    // B) Permanent Enters Battlefield (Stack -> Battlefield, or Hand -> Battlefield for Lands)
    const prevBattlefield = prevP.battlefield ?? {}
    const nextBattlefield = nextP.battlefield ?? {}

    for (const [permId, perm] of Object.entries(nextBattlefield)) {
      if (!(permId in prevBattlefield)) {
        const wasInStack = permId in prevStack || (perm.parentId && perm.parentId in prevStack)

        let originRect: DOMRect | null = null
        let originSize: CardSourceSize | null = null

        // Check registry first: card may have just unmounted from hand/stack
        const prevRegistered = getPreviousCardPosition(permId)
        if (prevRegistered) {
          originRect = prevRegistered
          originSize = getPreviousCardSize(permId)
        } else if (wasInStack) {
          originRect = stackRect
        } else if (permId in (prevP.graveyard ?? {})) {
          // Reanimar: el origen real es la pila del cementerio, no la mano.
          originRect = graveRect
        } else {
          originRect = handRect
        }

        if (originRect) {
          flyAfterLayout(permId, perm, originRect, [
            `[data-card-id="${permId}"]`,
            `${pSel} .creatures-band [data-card-id="${permId}"]`,
            `${pSel} .creatures-band`,
            `${pSel} .permanents-band`,
          ], getRect(`${pSel} .creatures-band`) ?? getRect(`${pSel} .permanents-band`), 350, originSize)
        } else {
          noteFlightEvent({ kind: 'skip', reason: 'no-source', cardId: permId, detail: `bf-enter:${(perm as { name?: string }).name ?? ''}` })
        }
      }
    }

    // C) El permanente sale del campo: cementerio, exilio o mano (bounce).
    //    Cada destino tiene su vuelo; lo que no llega a ningún lado visible
    //    (token que deja de existir, carta a la biblioteca) no vuela — antes
    //    volaba un fantasma erróneo al cementerio en todos los casos.
    const myHandIds = nextGame.myHand ?? {}
    for (const [permId, perm] of Object.entries(prevBattlefield)) {
      if (permId in nextBattlefield) continue
      const inGrave = permId in (nextP.graveyard ?? {})
      const inExile = permId in (nextP.exile ?? {})
      const bouncedToHand = permId in myHandIds
      if (!inGrave && !inExile && !bouncedToHand) continue
      const registered = getPreviousCardPosition(permId)
      const prevCardRect = registered ?? getRect(`[data-card-id="${permId}"]`)
      if (!prevCardRect) {
        noteFlightEvent({ kind: 'skip', reason: 'no-source', cardId: permId, detail: 'bf-leave' })
        continue
      }
      const prevSize = registered ? getPreviousCardSize(permId) : null
      if (inExile) {
        flyAfterLayout(permId, perm, prevCardRect, [
          `${pSel} .exile-stack [data-card-id="${permId}"]`,
          `${pSel} .exile-stack`,
        ], getRect(`${pSel} .exile-stack`), 350, prevSize)
      } else if (bouncedToHand) {
        flyAfterLayout(permId, perm, prevCardRect, [
          `[data-card-id="${permId}"]`,
          '.hand-bar .hand-card-slot:last-child',
          `${pSel} .hand-zone .hand-card-slot:last-child`,
        ], getRect('.hand-bar') ?? getRect(`${pSel} .hand-zone`), 350, prevSize)
      } else {
        // Destino con ámbito al cementerio: el id puede seguir presente como
        // top-card del propio montón del cementerio (nunca el slot de origen).
        flyAfterLayout(permId, perm, prevCardRect, [
          `${pSel} .graveyard-stack [data-card-id="${permId}"]`,
        ], graveRect, 350, prevSize)
      }
    }

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
        shakeElement(sel)
        const el = document.querySelector(sel) as HTMLElement | null
        if (el) {
          spawnFloater(`card:${permId}`, el.getBoundingClientRect(), `-${nextDamage - prevDamage}`, 'bad')
        }
      }
    }

    const prevLife = prevP.life ?? 0
    const nextLife = nextP.life ?? 0
    if (nextLife !== prevLife) {
      const playerEls = Array.from(document.querySelectorAll(`[data-player-id="${nextP.playerId}"]`))
      const deepest = playerEls.reduce<Element | null>((acc, el) => (!acc || acc.contains(el) ? el : acc), null)
      if (deepest) {
        if (nextLife < prevLife) {
          deepest.classList.remove('took-damage')
          void (deepest as HTMLElement).offsetWidth
          deepest.classList.add('took-damage')
          setTimeout(() => deepest.classList.remove('took-damage'), 420)
        }
        spawnFloater(
          `life:${nextP.playerId}`,
          deepest.getBoundingClientRect(),
          nextLife < prevLife ? `-${prevLife - nextLife}` : `+${nextLife - prevLife}`,
          nextLife < prevLife ? 'bad' : 'good'
        )
      }
    }
  }

  // E) Stack resolution: items que salen del stack sin entrar en battlefield.
  //    - Si aparecen en el graveyard/exile de un jugador → vuelo hasta el montón.
  //    - Si desaparecen sin destino visible (resolución sin permanente) → flash
  //      de resolución en sitio (clon estático que aparece y se desvanece).
  for (const [spellId, spell] of Object.entries(prevStack)) {
    if (spellId in nextStack) continue
    if (nextPlayers.some((p) => spellId in (p.battlefield ?? {}))) continue

    const registered = getPreviousCardPosition(spellId)
    const prevRect = registered ?? getRect(`[data-card-id="${spellId}"]`)
    if (!prevRect) {
      noteFlightEvent({ kind: 'skip', reason: 'no-source', cardId: spellId, detail: 'stack-resolve' })
      continue
    }
    const prevSize = registered ? getPreviousCardSize(spellId) : null

    let destSelectors: string[] = []
    let fallbackRect: DOMRect | null = null
    for (const p of nextPlayers) {
      const ps = getPlayerSelector(p.playerId, p.name)
      if (!ps) continue
      if (p.graveyard && spellId in p.graveyard) {
        destSelectors = [`${ps} .graveyard-stack [data-card-id="${spellId}"]`, `${ps} .graveyard-stack`]
        fallbackRect = getRect(`${ps} .graveyard-stack`)
        break
      }
      if (p.exile && spellId in p.exile) {
        destSelectors = [`${ps} .exile-stack [data-card-id="${spellId}"]`, `${ps} .exile-stack`]
        fallbackRect = getRect(`${ps} .exile-stack`)
        break
      }
    }

    if (destSelectors.length > 0) {
      flyAfterLayout(spellId, spell, prevRect, destSelectors, fallbackRect, 380, prevSize)
    } else {
      startCardFlight(spell, prevRect, prevRect, 340, undefined, { static: true, sourceSize: prevSize })
    }
  }

  // F) Nuevos atacantes → sacudida del jugador/grupo defensor atacado.
  const prevAttackers = new Set<string>()
  for (const group of prevGame.combat ?? []) {
    stringList((group as { attackers?: unknown }).attackers).forEach((id) => prevAttackers.add(id))
  }
  for (const group of nextGame.combat ?? []) {
    const rec = group as Record<string, unknown>
    const attackers = stringList(rec.attackers)
    if (attackers.length === 0 || !attackers.some((id) => !prevAttackers.has(id))) continue
    for (const defId of stringList(rec.defenders)) {
      shakeElement(`[data-player-id="${defId}"]`)
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
