import { useLayoutEffect, useRef } from 'react'
import type { PlayerView } from '../net/types'
import { fxMotionAllowed, fxOpacityAllowed } from './fx'
import { cardNodesIn } from './cardNodes'
import { cardManaColors } from './impactFx'
import { ARENA_EASE, fxTimeline } from '../fx/fxEngine'
import { vfx } from '../fx/vfxEngine'
import { manaToVfxColor } from '../fx/vfxPalette'

export const TOKEN_POP_MS = 280

type PopMode = 'pop' | 'fade'

function popMode(): PopMode | null {
  if (fxMotionAllowed()) return 'pop'
  return fxOpacityAllowed() ? 'fade' : null
}

/**
 * Arena-style token materialization: tokens pop directly in their battlefield
 * slot with a synchronized Canvas 2D shockwave & spark burst (never flying from hand).
 */
export function useTokenPop(scopes: ReadonlyArray<HTMLElement | null>, player: PlayerView | undefined): void {
  const seenRef = useRef<{ playerId: string; ids: Set<string> } | null>(null)

  useLayoutEffect(() => {
    if (!player) return
    const battlefield = player.battlefield ?? {}
    const ids = Object.keys(battlefield)
    const prev = seenRef.current
    seenRef.current = { playerId: player.playerId, ids: new Set(ids) }
    if (!prev || prev.playerId !== player.playerId) return
    const fresh = ids.filter((id) => battlefield[id]?.isToken === true && !prev.ids.has(id))
    if (fresh.length === 0) return
    const mode = popMode()
    if (!mode) return

    const nodes = cardNodesIn(scopes)
    for (const id of fresh) {
      const node = nodes.get(id)
      if (!node) continue
      // Measure before GSAP scales the node down.
      const rect = node.getBoundingClientRect()
      const color = manaToVfxColor(cardManaColors(battlefield[id])[0])

      if (mode === 'fade') {
        const tl = fxTimeline(undefined, { allowReducedMotion: true })
        tl?.fromTo(
          node,
          { opacity: 0 },
          { opacity: 1, duration: 0.15, ease: 'power2.out', clearProps: 'opacity' },
        )
        continue
      }

      const tl = fxTimeline()
      tl?.fromTo(
        node,
        { scale: 0.15, rotation: 6, opacity: 0 },
        {
          scale: 1,
          rotation: 0,
          opacity: 1,
          duration: TOKEN_POP_MS / 1000,
          ease: ARENA_EASE.pop,
          clearProps: 'scale,rotation,opacity',
        },
      )

      if (rect.width > 0 && rect.height > 0) {
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        vfx.shockwave(cx, cy, color, { startR: 8, endR: Math.max(rect.width, rect.height) * 0.75, lineWidth: 3, duration: 0.3 })
        vfx.sparkBurst(cx, cy, color, { count: 16, speed: 210, size: 3.6, life: 0.36, gravity: 80 })
      }
    }
  })
}
