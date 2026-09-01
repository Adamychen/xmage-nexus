import { useEffect, useState, useMemo, useCallback } from 'react'
import type { GameView } from '../net/types'
import './CombatArrowsOverlay.css'

interface ArrowItem {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  type: 'attack' | 'block' | 'target'
}

interface CombatArrowsOverlayProps {
  game: GameView | null
  boardRef: React.RefObject<HTMLDivElement | null>
  targetSourceId?: string
  chosenTargetIds?: string[]
  combatChosen?: string[]
  combatMode?: 'attack' | 'block' | null
}

const EMPTY_ARRAY: string[] = []

export default function CombatArrowsOverlay({
  game,
  boardRef,
  targetSourceId,
  chosenTargetIds = EMPTY_ARRAY,
  combatChosen = EMPTY_ARRAY,
  combatMode,
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
        .filter((p) => p.life <= 0 || p.hasLeft || (p as any).lost)
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
          return {
            x: rect.left + rect.width / 2 - boardRect.left,
            y: rect.top + rect.height / 2 - boardRect.top,
            rect,
          }
        }
        return null
      }

      const cardEl = boardEl.querySelector(`[data-card-id="${id}"]`) || document.querySelector(`[data-card-id="${id}"]`)
      if (cardEl) {
        const c = centerOf(cardEl)
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

    const makeArrow = (id: string, from: { x: number; y: number; rect: DOMRect }, to: { x: number; y: number; rect: DOMRect }, type: ArrowItem['type']): ArrowItem => {
      const dx = to.x - from.x
      const dy = to.y - from.y
      const dist = Math.hypot(dx, dy) || 1
      const ux = dx / dist
      const uy = dy / dist
      const startInset = Math.min(from.rect.width, from.rect.height) * 0.42
      const endInset = type === 'target' ? 12 : 18
      return {
        id,
        x1: from.x + ux * startInset,
        y1: from.y + uy * startInset,
        x2: to.x - ux * endInset,
        y2: to.y - uy * endInset,
        type,
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
              newArrows.push(makeArrow(`att-${gi}-${attId}`, attCenter, defCenter, 'attack'))
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
                newArrows.push(makeArrow(`blk-${gi}-${blkId}`, blkCenter, firstAttCenter, 'block'))
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
                newArrows.push(makeArrow(`chosen-att-${attId}`, attCenter, defCenter, 'attack'))
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
            newArrows.push(makeArrow(`target-${ti}-${tgtId}`, sourceCenter, tgtCenter, 'target'))
          }
        })
      }
    }

    // 5. Stack spell/ability targeting arrows from stack items -> their targets
    if (game.stack && typeof game.stack === 'object') {
      Object.entries(game.stack).forEach(([stackId, stackCard]) => {
        const sourceCenter = getCenter(stackId)
        if (!sourceCenter) return

        const cardObj = stackCard as unknown as Record<string, unknown>
        const targets = cardObj.targets ?? cardObj.targetIds ?? cardObj.chosenTargets ?? []
        const targetList: string[] = Array.isArray(targets)
          ? targets.map((t: any) => typeof t === 'string' ? t : t?.id).filter(Boolean)
          : typeof targets === 'object' && targets !== null
          ? Object.keys(targets)
          : []

        targetList.forEach((tgtId, ti) => {
          const tgtCenter = getCenter(tgtId)
          if (tgtCenter) {
            newArrows.push(makeArrow(`stack-target-${stackId}-${ti}-${tgtId}`, sourceCenter, tgtCenter, 'target'))
          }
        })
      })
    }

    return newArrows
  }, [game, boardRef, targetSourceId, chosenTargetIds, combatChosen, combatMode, me, opp])

  useEffect(() => {
    const update = () => {
      setArrows(computeArrows())
    }
    update()
    window.addEventListener('resize', update)
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
      document.removeEventListener('scroll', onScroll, true)
      observer?.disconnect()
    }
  }, [computeArrows, boardRef])

  if (arrows.length === 0) return null

  return (
    <svg className="combat-arrows-overlay" aria-hidden="true">
      <defs>
        {/* Attack Arrow Marker (Red / Crimson) */}
        <marker
          id="marker-attack"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="8.5"
          markerHeight="8.5"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#ff4757" stroke="#7a1020" strokeWidth="0.6" />
        </marker>

        {/* Block Arrow Marker (Cyan / Blue) */}
        <marker
          id="marker-block"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="8.5"
          markerHeight="8.5"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" stroke="#0c4a6e" strokeWidth="0.6" />
        </marker>

        {/* Target Arrow Marker (Gold / Amber) */}
        <marker
          id="marker-target"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="8.5"
          markerHeight="8.5"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#ffd070" stroke="#7c4a03" strokeWidth="0.6" />
        </marker>

        {/* Glow Filters */}
        <filter id="glow-attack" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="glow-block" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="glow-target" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {arrows.map((a) => {
        // Curve control point
        const dx = a.x2 - a.x1
        const dy = a.y2 - a.y1
        const mx = (a.x1 + a.x2) / 2
        const my = (a.y1 + a.y2) / 2
        // Slight curvature perpendicular to direction
        const curveFactor = 0.15
        const cx = mx - dy * curveFactor
        const cy = my + dx * curveFactor

        const pathData = `M ${a.x1} ${a.y1} Q ${cx} ${cy} ${a.x2} ${a.y2}`

        return (
          <g key={a.id} className={`arrow-group arrow-${a.type}`}>
            {/* Background shadow stroke */}
            <path
              d={pathData}
              className="arrow-shadow"
            />
            {/* Glowing animated path */}
            <path
              d={pathData}
              className={`arrow-path arrow-${a.type}`}
              markerEnd={`url(#marker-${a.type})`}
              filter={`url(#glow-${a.type})`}
            />
          </g>
        )
      })}
    </svg>
  )
}
