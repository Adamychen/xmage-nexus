import { useLayoutEffect, useRef } from 'react'
import { fxMotionAllowed, fxMotionDuration } from './fx'
import { cardNodesIn } from './cardNodes'

export const UNTAP_WAVE_MS = 250
export const UNTAP_WAVE_STAGGER_MS = 40
export const UNTAP_WAVE_MIN_CARDS = 2

interface TapPose {
  rotate: string
  scale: string
}

const TAPPED_POSE: Record<'normal' | 'tilted', Record<'classic' | 'compact', TapPose>> = {
  normal: {
    classic: { rotate: '90deg', scale: '1' },
    compact: { rotate: '90deg', scale: '0.75' },
  },
  tilted: {
    classic: { rotate: '45deg', scale: '0.825' },
    compact: { rotate: '45deg', scale: '0.606' },
  },
}

function tappedPose(node: HTMLElement, tilted: boolean): TapPose {
  const style = tilted ? TAPPED_POSE.tilted : TAPPED_POSE.normal
  return node.classList.contains('is-compact') ? style.compact : style.classic
}

function playUntapWave(node: HTMLElement, index: number, tilted: boolean): void {
  if (typeof node.animate !== 'function') return
  node.getAnimations?.().forEach((animation) => {
    if ((animation as Animation & { transitionProperty?: string }).transitionProperty === 'transform') {
      animation.cancel()
    }
  })
  const from = tappedPose(node, tilted)
  node.animate(
    [
      { rotate: from.rotate, scale: from.scale },
      { rotate: '0deg', scale: '1' },
    ],
    {
      duration: fxMotionDuration(UNTAP_WAVE_MS),
      delay: index * UNTAP_WAVE_STAGGER_MS,
      easing: 'ease-out',
      fill: 'backwards',
    },
  )
}

export function useUntapWave(scopes: ReadonlyArray<HTMLElement | null>, tiltedTaps: boolean): void {
  const tappedRef = useRef<Map<string, boolean> | null>(null)

  useLayoutEffect(() => {
    const next = new Map<string, boolean>()
    const untapped: HTMLElement[] = []
    const prev = tappedRef.current
    for (const [id, node] of cardNodesIn(scopes)) {
      const tapped = node.dataset.tapped === '1'
      next.set(id, tapped)
      if (prev?.get(id) === true && !tapped) untapped.push(node)
    }
    tappedRef.current = next
    if (untapped.length < UNTAP_WAVE_MIN_CARDS || !fxMotionAllowed()) return
    untapped.forEach((node, index) => playUntapWave(node, index, tiltedTaps))
  })
}
