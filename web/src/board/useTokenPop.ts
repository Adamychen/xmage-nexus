import { useLayoutEffect, useRef } from 'react'
import type { PlayerView } from '../net/types'
import { fxMotionAllowed, fxMotionDuration, fxOpacityAllowed, fxOpacityDuration } from './fx'
import { cardNodesIn } from './cardNodes'
import { spawnTokenBurst } from './tokenBurst'
import { cardManaColors } from './impactFx'
import './tokenBurst.css'

export const TOKEN_POP_MS = 300

type PopMode = 'pop' | 'fade'

function popMode(): PopMode | null {
  if (fxMotionAllowed()) return 'pop'
  return fxOpacityAllowed() ? 'fade' : null
}

function playTokenPop(node: HTMLElement, mode: PopMode): void {
  if (typeof node.animate !== 'function') return
  if (mode === 'fade') {
    node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: fxOpacityDuration(TOKEN_POP_MS), easing: 'ease-out' })
    return
  }
  node.animate(
    [
      { scale: '0', rotate: '5deg', easing: 'ease-out', offset: 0 },
      { scale: '1.2', rotate: '0deg', easing: 'ease-in-out', offset: 0.6 },
      { scale: '1', rotate: '0deg', offset: 1 },
    ],
    { duration: fxMotionDuration(TOKEN_POP_MS) },
  )
}

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
      const rect = node.getBoundingClientRect()
      playTokenPop(node, mode)
      spawnTokenBurst(rect, cardManaColors(battlefield[id])[0] ?? null)
    }
  })
}
