import { useEffect, useState, useMemo, useCallback } from 'react'
import { BOARD_RELAYOUT_EVENT } from './layout/relayout'
import { isPlayerOut } from './boardShared'
import type { GameView } from '../net/types'
import { seatColorVar, seatIndexOf } from './seatColor'
import './CombatArrowsOverlay.css'

interface ArrowItem {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  type: 'attack' | 'block' | 'target'
  /** Origen/destino lógicos (UUID de carta o jugador) para poder asertar a
   *  quién apunta cada flecha en los tests (pod multijugador). */
  fromId: string
  toId: string
  path?: string
  color?: string
}

interface CombatArrowsOverlayProps {
  game: GameView | null
  boardRef: React.RefObject<HTMLDivElement | null>
  targetSourceId?: string
  chosenTargetIds?: string[]
  combatChosen?: string[]
  combatMode?: 'attack' | 'block' | null
  stackFocusIds?: ReadonlySet<string> | null
  variant?: 'v1' | 'v2'
}

const EMPTY_ARRAY: string[] = []

type Pt = { x: number; y: number }

/**
 * TGT-12: every arrow leaves its source through the top edge and comes into its target through the
 * bottom edge, whatever is acting: a spell on the stack, an ability, an attacker or a blocker. The
 * source points up and out, the target is reached from below, and nobody has to work out which end
 * of the beam is which.
 */
export function arrowAnchors(
  from: Pt & { rect: DOMRect },
  to: Pt & { rect: DOMRect },
): { a: Pt; b: Pt } {
  return {
    a: { x: from.x, y: from.y - from.rect.height / 2 },
    b: { x: to.x, y: to.y + to.rect.height / 2 },
  }
}

/** The curve between those two: it leaves the source upwards and rises into the target from
 *  below, so both ends meet their card square. The handles stay inside the board (`height`, when
 *  it is known), because a curve that swings off the screen is drawn as a straight cut across the
 *  edge and reads as two arrows instead of one. */
export function arrowPath(a: Pt, b: Pt, height?: number): string {
  const span = Math.hypot(b.x - a.x, b.y - a.y)
  const bow = Math.max(28, Math.min(140, span * 0.35))
  const r = (v: number) => Math.round(v)
  const bounded = !!height && height > 40
  const lo = bounded ? 6 : -Infinity
  const hi = bounded ? height - 6 : Infinity
  const clamp = (v: number) => Math.max(lo, Math.min(hi, v))
  const c1y = clamp(a.y - bow)
  const c2y = clamp(b.y + bow)
  return `M ${r(a.x)} ${r(a.y)} C ${r(a.x)} ${r(c1y)} ${r(b.x)} ${r(c2y)} ${r(b.x)} ${r(b.y)}`
}

/**
 * TGT-12 inside the cascade: an object aimed at another object on the stack leaves through its top
 * edge like any arrow, swings out past the cascade's left edge (`left`) and rises into the bottom
 * of its target, at the corner of a covered card that stays in view. A straight beam between two
 * cards that lie over each other would be a stub hidden under them.
 */
export function stackLoopPath(a: Pt, b: Pt, left: number, height?: number): string {
  const r = (v: number) => Math.round(v)
  const bounded = !!height && height > 40
  const clamp = (v: number) => (bounded ? Math.max(6, Math.min(height - 6, v)) : v)
  const drop = Math.max(24, Math.min(60, Math.abs(a.y - b.y) * 0.4))
  const midY = (a.y + b.y) / 2
  return [
    `M ${r(a.x)} ${r(a.y)}`,
    `C ${r(a.x)} ${r(clamp(a.y - drop))} ${r(left)} ${r(clamp(a.y - drop))} ${r(left)} ${r(midY)}`,
    `C ${r(left)} ${r(clamp(b.y + drop * 2))} ${r(b.x)} ${r(clamp(b.y + drop * 2))} ${r(b.x)} ${r(b.y)}`,
  ].join(' ')
}

export default function CombatArrowsOverlay({
  game,
  boardRef,
  targetSourceId,
  chosenTargetIds = EMPTY_ARRAY,
  combatChosen = EMPTY_ARRAY,
  combatMode,
  stackFocusIds = null,
  variant = 'v1',
}: CombatArrowsOverlayProps) {
  const [arrows, setArrows] = useState<ArrowItem[]>([])

  const me = useMemo(() => game?.players?.find((p) => p.controlled), [game?.players])
  const opp = useMemo(() => game?.players?.find((p) => !p.controlled), [game?.players])

  const computeArrows = useCallback((): ArrowItem[] => {
    const boardEl = boardRef.current
    if (!boardEl || !game) {
      return []
    }

    const boardRect = boardEl.getBoundingClientRect()
    const newArrows: ArrowItem[] = []

    const defeatedPlayerIds = new Set(
      (game.players ?? [])
        .filter((p) => isPlayerOut(p))
        .map((p) => p.playerId)
    )

    const isDefeatedOrLost = (id: string): boolean => {
      if (defeatedPlayerIds.has(id)) return true
      for (const p of game.players ?? []) {
        if (defeatedPlayerIds.has(p.playerId)) {
          if (id in (p.battlefield ?? {}) || id in (p.graveyard ?? {}) || id in (p.exile ?? {})) {
            return true
          }
        }
      }
      return false
    }

    const getCenter = (id: string): { x: number; y: number; rect: DOMRect } | null => {
      if (isDefeatedOrLost(id)) return null
      const centerOf = (el: Element) => {
        const rect = el.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          // Centros a píxel entero: los rects traen fracciones que varían unas
          // milésimas entre sesiones (layout de WebKit) y, si el punto cae en
          // un .5 exacto, el redondeo de la punta de flecha oscila y rompe los
          // baselines de regresión visual.
          return {
            x: Math.round(rect.left + rect.width / 2 - boardRect.left),
            y: Math.round(rect.top + rect.height / 2 - boardRect.top),
            rect,
          }
        }
        return null
      }

      const cardEl = boardEl.querySelector(`[data-card-id="${id}"]`) || document.querySelector(`[data-card-id="${id}"]`)
      if (cardEl) {
        const thumb = cardEl.querySelector('.stack-thumb')
        const c = (thumb && centerOf(thumb)) || centerOf(cardEl)
        if (c) return c
      }

      // Players: prefer the avatar anchor, then the deepest [data-player-id]
      // (BoardZone root and PlayerInfoBar both carry the attribute; the zone
      // root's center falls in the lands band, not on the player).
      const scope = boardEl.parentElement ?? document
      let playerEl =
        boardEl.querySelector(`[data-player-id="${id}"] [data-player-anchor]`) ||
        (scope.querySelector(`[data-player-id="${id}"] [data-player-anchor]`) as Element | null)
      if (!playerEl) {
        const candidates = Array.from(
          boardEl.querySelectorAll(`[data-player-id="${id}"]`) as NodeListOf<Element>
        )
        if (candidates.length === 0) {
          candidates.push(...Array.from(document.querySelectorAll(`[data-player-id="${id}"]`)))
        }
        playerEl = candidates.reduce<Element | null>((deepest, el) => {
          if (!deepest || deepest.contains(el)) return el
          return deepest
        }, null)
      }
      if (playerEl) {
        const c = centerOf(playerEl)
        if (c) return c
      }
      return null
    }

    const seated = variant === 'v2'
    const controllerOf = (cardId: string): string | undefined => {
      for (const p of game.players ?? []) {
        if (cardId in (p.battlefield ?? {})) return p.playerId
      }
      const onStack = (game.stack as Record<string, { controllerId?: string }> | undefined)?.[cardId]
      if (onStack?.controllerId) return String(onStack.controllerId)
      if (cardId in (game.myHand ?? {})) return me?.playerId
      return undefined
    }

    const makeArrow = (id: string, from: { x: number; y: number; rect: DOMRect }, to: { x: number; y: number; rect: DOMRect }, type: ArrowItem['type'], fromId = '', toId = ''): ArrowItem => {
      // TGT-12: out of the source's top edge, into the target's bottom edge.
      const { a, b } = arrowAnchors(from, to)
      if (seated) {
        return {
          id,
          x1: Math.round(a.x),
          y1: Math.round(a.y),
          x2: Math.round(b.x),
          y2: Math.round(b.y),
          type,
          fromId,
          toId,
          path: arrowPath(a, b, boardRect.height),
          color: seatColorVar(seatIndexOf(game.players, controllerOf(fromId) ?? me?.playerId)),
        }
      }
      // Whole pixels at both ends: with integer input the dart sits identically between sessions.
      const end = (v: number) => Math.round(v)
      return {
        id,
        x1: end(a.x),
        y1: end(a.y),
        x2: end(b.x),
        y2: end(b.y),
        type,
        fromId,
        toId,
        path: arrowPath(a, b, boardRect.height),
      }
    }

    // 1. Attack arrows from game.combat groups
    if (Array.isArray(game.combat) && game.combat.length > 0) {
      game.combat.forEach((group, gi) => {
        const record = group as Record<string, unknown>
        const attackersObj = record.attackers
        const attackerIds = Array.isArray(attackersObj)
          ? attackersObj
          : attackersObj && typeof attackersObj === 'object'
          ? Object.keys(attackersObj)
          : []
        attackerIds.forEach((attId) => {
          let defenderId = (record.defenderId as string) || null

          if (!defenderId) {
            // If attacker is controlled by me, target opponent; if controlled by opponent, target me
            const isMyAttacker = me && String(attId) in (me.battlefield ?? {})
            const isOppAttacker = opp && String(attId) in (opp.battlefield ?? {})
            if (isMyAttacker) {
              defenderId = opp ? opp.playerId : null
            } else if (isOppAttacker) {
              defenderId = me ? me.playerId : null
            } else {
              const isMyTurn = game.activePlayerId === me?.playerId
              defenderId = isMyTurn ? (opp ? opp.playerId : null) : (me ? me.playerId : null)
            }
          }

          if (defenderId) {
            const defCenter = getCenter(defenderId)
            const attCenter = getCenter(String(attId))
            if (defCenter && attCenter) {
              newArrows.push(makeArrow(`att-${gi}-${attId}`, attCenter, defCenter, 'attack', String(attId), String(defenderId)))
            }
          }
        })

        // 2. Block arrows from group.blockers -> attackers
        const blockersObj = record.blockers
        const blockerIds = Array.isArray(blockersObj)
          ? blockersObj
          : blockersObj && typeof blockersObj === 'object'
          ? Object.keys(blockersObj)
          : []

        if (attackerIds.length > 0) {
          const firstAttCenter = getCenter(String(attackerIds[0]))
          if (firstAttCenter) {
            blockerIds.forEach((blkId) => {
              const blkCenter = getCenter(String(blkId))
              if (blkCenter) {
                newArrows.push(makeArrow(`blk-${gi}-${blkId}`, blkCenter, firstAttCenter, 'block', String(blkId), String(attackerIds[0])))
              }
            })
          }
        }
      })
    }

    // 3. Attack arrows from combatChosen during DECLARE_ATTACKERS
    if (game.step === 'DECLARE_ATTACKERS' && combatMode === 'attack' && combatChosen.length > 0) {
      const activePlayer = game.players?.find((p) => p.playerId === game.activePlayerId)
      const defendingPlayer = game.players?.find((p) => p.playerId !== game.activePlayerId)
      if (activePlayer && defendingPlayer) {
        const defCenter = getCenter(defendingPlayer.playerId)
        if (defCenter) {
          combatChosen.forEach((attId) => {
            const isAttackerCard = String(attId) in (activePlayer.battlefield ?? {})
            if (!isAttackerCard) return

            if (!newArrows.some((a) => a.id.includes(attId) && a.type === 'attack')) {
              const attCenter = getCenter(attId)
              if (attCenter) {
                newArrows.push(makeArrow(`chosen-att-${attId}`, attCenter, defCenter, 'attack', String(attId), String(defendingPlayer.playerId)))
              }
            }
          })
        }
      }
    }

    // 4. Targeting arrows from targetSourceId -> chosenTargetIds
    if (targetSourceId && chosenTargetIds.length > 0) {
      const sourceCenter = getCenter(targetSourceId)
      if (sourceCenter) {
        chosenTargetIds.forEach((tgtId, ti) => {
          const tgtCenter = getCenter(tgtId)
          if (tgtCenter) {
            newArrows.push(makeArrow(`target-${ti}-${tgtId}`, sourceCenter, tgtCenter, 'target', String(targetSourceId), String(tgtId)))
          }
        })
      }
    }

    // 5. Stack spell/ability targeting arrows from stack items -> their targets
    if (game.stack && typeof game.stack === 'object') {
      Object.entries(game.stack).forEach(([stackId, stackCard]) => {
        if (stackFocusIds && !stackFocusIds.has(stackId)) return
        const sourceCenter = getCenter(stackId)
        if (!sourceCenter) return

        const cardObj = stackCard as unknown as Record<string, unknown>
        const targets = cardObj.targets ?? cardObj.targetIds ?? cardObj.chosenTargets ?? []
        const targetList: string[] = Array.isArray(targets)
          ? targets.map((t: unknown) => typeof t === 'string' ? t : (t as { id?: string } | null)?.id).filter((id): id is string => !!id)
          : typeof targets === 'object' && targets !== null
          ? Object.keys(targets)
          : []

        // Both ends on the stack: the objects lie over each other, so a straight line between them
        // is a stub hidden under the cards. Those arrows loop out past the cascade's left edge and
        // rise into the bottom of the covered card, at the corner of it that stays in view.
        const stackEl = boardEl.querySelector('.stack-zone')
        const controllerId = String(cardObj.controllerId ?? '')
        const seatColor = seatColorVar(seatIndexOf(game.players, controllerId))

        targetList.forEach((tgtId, ti) => {
          const tgtCenter = getCenter(tgtId)
          if (!tgtCenter) return
          const tgtEl = boardEl.querySelector(`[data-card-id="${tgtId}"]`)
          const sourceEl = boardEl.querySelector(`[data-card-id="${stackId}"]`)
          const inDeck = !!stackFocusIds && !!stackEl?.contains(sourceEl) && !!tgtEl && stackEl.contains(tgtEl)
          if (inDeck && stackEl) {
            const cascadeLeft = (stackEl.querySelector('.stack-cascade') ?? stackEl).getBoundingClientRect().left
            const { a } = arrowAnchors(sourceCenter, tgtCenter)
            const corner = Math.min(24, tgtCenter.rect.width / 4)
            const b = { x: tgtCenter.rect.left - boardRect.left + corner, y: tgtCenter.rect.bottom - boardRect.top }
            newArrows.push({
              id: `stack-target-${stackId}-${ti}-${tgtId}`,
              x1: Math.round(a.x), y1: Math.round(a.y), x2: Math.round(b.x), y2: Math.round(b.y),
              type: 'target',
              fromId: String(stackId),
              toId: String(tgtId),
              path: stackLoopPath(a, b, cascadeLeft - boardRect.left - 40, boardRect.height),
              color: seatColor,
            })
            return
          }
          newArrows.push(makeArrow(`stack-target-${stackId}-${ti}-${tgtId}`, sourceCenter, tgtCenter, 'target', String(stackId), String(tgtId)))
        })
      })
    }

    return newArrows
  }, [game, boardRef, targetSourceId, chosenTargetIds, combatChosen, combatMode, me, opp, stackFocusIds, variant])

  useEffect(() => {
    const update = () => {
      setArrows(computeArrows())
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener(BOARD_RELAYOUT_EVENT, update)
    const boardEl = boardRef.current
    let observer: ResizeObserver | null = null
    if (boardEl && typeof ResizeObserver === 'function') {
      observer = new ResizeObserver(update)
      observer.observe(boardEl)
    }
    const onScroll = (e: Event) => {
      if (boardEl && e.target instanceof Node && boardEl.contains(e.target)) {
        update()
      }
    }
    document.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener(BOARD_RELAYOUT_EVENT, update)
      document.removeEventListener('scroll', onScroll, true)
      observer?.disconnect()
    }
  }, [computeArrows, boardRef])

  if (arrows.length === 0) return null

  return (
    <svg className="combat-arrows-overlay" aria-hidden="true">
      <defs>
        {/* TGT-11: the head is a dart, notched at the back, so it reads as a point and not as a
            blob where the stroke ends. */}
        {(['attack', 'block', 'target'] as const).map((kind) => (
          <marker
            key={kind}
            id={`marker-${kind}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0.6 L 10 5 L 0 9.4 L 2.6 5 z" className={`arrow-head arrow-head-${kind}`} />
          </marker>
        ))}

      </defs>

      {arrows.map((a) => {
        // Curve control point
        const dx = a.x2 - a.x1
        const dy = a.y2 - a.y1
        const mx = (a.x1 + a.x2) / 2
        const my = (a.y1 + a.y2) / 2
        // Slight curvature perpendicular to direction
        const curveFactor = 0.15
        // Punto de control también a píxel entero: con extremos enteros el
        // rasterizado de la punta del marcador deja de oscilar entre sesiones
        // (WebKit). La desviación de la curva es < 0.5 px.
        const cx = Math.round(mx - dy * curveFactor)
        const cy = Math.round(my + dx * curveFactor)

        const pathData = a.path ?? `M ${a.x1} ${a.y1} Q ${cx} ${cy} ${a.x2} ${a.y2}`
        if (a.color) {
          const markerId = `marker-seat-${a.id.replace(/[^\w-]/g, '_')}`
          return (
            <g
              key={a.id}
              className={`arrow-group arrow-${a.type} arrow-group--v2`}
              data-arrow-from={a.fromId}
              data-arrow-to={a.toId}
            >
              <marker id={markerId} viewBox="0 0 10 10" markerWidth="7" markerHeight="7" refX="9" refY="5" orient="auto-start-reverse">
                <path d="M 0 0.6 L 10 5 L 0 9.4 L 2.6 5 z" style={{ fill: a.color }} />
              </marker>
              <path
                d={pathData}
                className={`arrow-path arrow-v2 arrow-${a.type}-v2`}
                style={{ stroke: a.color, color: a.color }}
                markerEnd={`url(#${markerId})`}
              />
            </g>
          )
        }

        return (
          <g
            key={a.id}
            className={`arrow-group arrow-${a.type}`}
            data-arrow-from={a.fromId}
            data-arrow-to={a.toId}
          >
            {/* Two strokes make the beam: a dark seam that keeps it legible over art, and the
                beam itself, in one colour. */}
            <path d={pathData} className="arrow-shadow" />
            <path
              d={pathData}
              className={`arrow-path arrow-${a.type}`}
              markerEnd={`url(#marker-${a.type})`}
            />
          </g>
        )
      })}
    </svg>
  )
}
