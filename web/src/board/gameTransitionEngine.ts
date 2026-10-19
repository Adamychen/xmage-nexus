import { useEffect, useMemo, useRef } from 'react'
import type { CardView, GameView, PlayerView } from '../net/types'
import { startCardFlight, noteFlightEvent, CAST_FLIGHT_MS, ENTER_FLIGHT_MS, ENTER_LAND_AT, type FlightTrail, type FlightVariant } from './flightManager'
import { enqueueStackResolve } from './stackHold'
import { releaseHeldHit } from './damageHold'
import { getPreviousCardPosition, getPreviousCardSize, clearCardPositionRegistry, type CardSourceSize } from './cardPositionRegistry'
import { announceBanner, spawnFloater } from './feedbackFx'
import { t } from '../i18n'
import { isAbilityCard } from '../cards/cardImages'
import { fxMotionAllowed, fxMotionDuration } from './fx'
import { cardManaColors, slamSpell, spawnImpact, spellWeight } from './impactFx'
import { spawnProjectile } from './projectileFx'
import { stackTargetIds } from './stackEntries'
import { clearCombatSnapshots, combatantIds, planDamageStrikes, playDamageStrikes, primeCombatHolds, snapshotCombatants } from './combatStrikes'
import { spawnDamageNumber } from './DamageNumber'
import { restingRect } from './restingRect'
import { observeCoinFlip } from './coinFlipFx'

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

function resolvedTo(spellId: string, game: GameView): 'battlefield' | 'graveyard' | null {
  for (const p of game.players ?? []) {
    const battlefield = p.battlefield ?? {}
    if (spellId in battlefield) return 'battlefield'
    if (Object.values(battlefield).some((perm) => (perm as { parentId?: string }).parentId === spellId)) return 'battlefield'
  }
  for (const p of game.players ?? []) {
    if (spellId in (p.graveyard ?? {}) || spellId in (p.exile ?? {})) return 'graveyard'
  }
  return null
}

function slamResolvedSpells(nextGame: GameView): void {
  const nextStack = nextGame.stack ?? {}
  for (const [spellId, spell] of pendingSlams) {
    if (spellId in nextStack) continue
    pendingSlams.delete(spellId)
    const destination = resolvedTo(spellId, nextGame)
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

/** Doble rAF: mide cuando React ha asentado el layout (p.ej. el fan de la mano
 *  recalcula overlap en su propio effect). Sin rAF (tests/jsdom), setTimeout. */
function scheduleAfterLayout(fn: () => void): void {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => requestAnimationFrame(fn))
  } else {
    setTimeout(fn, 34)
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

/**
 * Where a spell is drawn right now: its large top card or its tab. Read when the spell resolves,
 * because its position was recorded before it became the top card and is stale by then.
 */
function stackSpellSource(spellId: string): { rect: DOMRect; size: CardSourceSize } | null {
  const el = (document.querySelector(`[data-card-id="${spellId}"] .stack-thumb`) ?? document.querySelector(`[data-card-id="${spellId}"]`)) as HTMLElement | null
  if (!el) return null
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  return { rect, size: { w: el.offsetWidth, h: el.offsetHeight } }
}

/** A spell leaving the stack for its graveyard/exile flies there; otherwise it flashes in place. */
function playStackSpellExit(spellId: string, spell: CardView, prevRect: DOMRect, prevSize: CardSourceSize | null, players: PlayerView[]) {
  let destSelectors: string[] = []
  let fallbackRect: DOMRect | null = null
  for (const p of players) {
    const ps = getPlayerSelector(p.playerId, p.name)
    if (!ps) continue
    if (p.graveyard && spellId in p.graveyard) {
      destSelectors = [`${ps} :is(.graveyard-stack, .graveyard-chip) [data-card-id="${spellId}"]`, `${ps} :is(.graveyard-stack, .graveyard-chip)`]
      fallbackRect = getRect(`${ps} :is(.graveyard-stack, .graveyard-chip)`)
      break
    }
    if (p.exile && spellId in p.exile) {
      destSelectors = [`${ps} .exile-stack [data-card-id="${spellId}"]`, `${ps} .exile-stack`]
      fallbackRect = getRect(`${ps} .exile-stack`)
      break
    }
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
  lift?: boolean
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
    startCardFlight(card, fromRect, toRect, duration, dest?.selector, { sourceSize, variant, trail, lift })
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
  const strikes = playDamageStrikes(planDamageStrikes(prevGame, nextGame), [...combatants])
  const later = (ms: number, fn: () => void) => (ms > 0 ? void setTimeout(fn, ms) : fn())
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
  const deathDelay = (id: string) => (combatants.has(id) ? strikes.holdMs : 0)

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

      // 1a. Check cardPositionRegistry first (card just unmounted from hand/battlefield)
      const srcId = spell.sourceCard?.id ?? spell.id
      if (srcId) {
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
  slamResolvedSpells(nextGame)
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
    const graveRect = getRect(`${pSel} :is(.graveyard-stack, .graveyard-chip)`)

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
    const handShrank = (nextP.handCount ?? 0) < (prevP.handCount ?? 0)
    if (graveArrivals.length > 0 && graveRect) {
      graveArrivals.slice(0, 3).forEach((id, i) => {
        if (id in (prevP.battlefield ?? {}) || id in prevStack) return
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
      const registered = getPreviousCardPosition(permId)
      if (!inGrave && !inExile && !bouncedToHand) {
        if ((perm as { isToken?: boolean }).isToken) {
          const fadeRect = registered ?? getRect(`[data-card-id="${permId}"]`)
          afterLanding(permId, deathDelay(permId), () => spawnImpact('token-fade', fadeRect))
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
            `${pSel} .exile-stack [data-card-id="${permId}"]`,
            `${pSel} .exile-stack`,
          ], getRect(`${pSel} .exile-stack`), 420, prevSize, 'exile')
        } else if (bouncedToHand) {
          flyAfterLayout(permId, perm, prevCardRect, [
            `[data-card-id="${permId}"]`,
            '.hand-bar .hand-card-slot:last-child',
            `${pSel} .hand-zone .hand-card-slot:last-child`,
          ], getRect('.hand-bar') ?? getRect(`${pSel} .hand-zone`), 350, prevSize)
        } else {
          // Destino con ámbito al cementerio: el id puede seguir presente como
          // top-card del propio montón del cementerio (nunca el slot de origen).
          const isLand = (perm.cardTypes ?? []).some((t) => String(t).toUpperCase() === 'LAND')
          if (!isLand) spawnImpact('destroy', prevCardRect)
          flyAfterLayout(permId, perm, prevCardRect, [
            `${pSel} :is(.graveyard-stack, .graveyard-chip) [data-card-id="${permId}"]`,
          ], graveRect, isLand ? 350 : 420, prevSize, isLand ? undefined : 'destroy')
        }
      })
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
        const struckAt = strikes.impactAt.get(permId)
        const hit = () => {
          if (struckAt === undefined) shakeElement(sel)
          const el = document.querySelector(sel) as HTMLElement | null
          if (!el) return
          const rect = el.getBoundingClientRect()
          if (document.querySelector(`.card-slot${sel}`)) spawnDamageNumber(`card:${permId}`, nextDamage - prevDamage)
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
        spawnFloater(
          `life:${nextP.playerId}`,
          deepest.getBoundingClientRect(),
          `+${nextLife - prevLife}`,
          'good'
        )
      }
    }
    if (nextLife !== prevLife) {
      if (lifeStruckAt === undefined) afterLanding(nextP.playerId, 0, lifeHit)
      else later(lifeStruckAt, lifeHit)
    }
  }

  // C) Spells that left the stack resolve one at a time: stackHold keeps each one on display
  //    until its turn ends. Its projectiles fly to its targets (each target's hit waits for the
  //    landing), then it exits to the graveyard/exile or flashes in place. Positions are read
  //    now, while the spell is still on display.
  for (const [spellId, spell] of Object.entries(prevStack)) {
    if (spellId in nextStack) continue
    const registered = getPreviousCardPosition(spellId)
    const prevRect = registered ?? getRect(`[data-card-id="${spellId}"]`)
    const prevSize = registered ? getPreviousCardSize(spellId) : null
    const colors = cardManaColors(spell)
    const targetIds = stackTargetIds(spell)
    const entersBattlefield = nextPlayers.some((p) => spellId in (p.battlefield ?? {}))
    enqueueStackResolve(spellId, (done) => {
      const exit = () => {
        if (prevRect && !entersBattlefield) {
          const source = stackSpellSource(spellId)
          playStackSpellExit(spellId, spell, source?.rect ?? prevRect, source?.size ?? prevSize, nextPlayers)
        }
        later(STACK_EXIT_MS, done)
      }
      if (!prevRect) {
        noteFlightEvent({ kind: 'skip', reason: 'no-source', cardId: spellId, detail: 'stack-resolve' })
        for (const targetId of targetIds) landed(targetId)
        done()
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
  useMemo(() => primeCombatHolds(prevGameRef.current, game), [game])

  useEffect(() => {
    if (!game) {
      prevGameRef.current = null
      prevGameIdRef.current = null
      clearPendingSlams()
      clearCombatSnapshots()
      return
    }

    const prevGame = prevGameRef.current
    if (prevGame === game) return
    const coinMs = observeCoinFlip(game, gameId)
    if (prevGame) {
      const prevId = prevGameIdRef.current
      if (gameId && prevId && gameId !== prevId) {
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
