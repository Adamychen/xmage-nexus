import { useLayoutEffect, useRef } from 'react'
import { fxMotionAllowed } from './fx'
import { cardNodesIn } from './cardNodes'
import { ARENA_EASE, fxTimeline } from '../fx/fxEngine'
import { vfx } from '../fx/vfxEngine'

export const UNTAP_WAVE_MS = 260
export const UNTAP_WAVE_STAGGER_MS = 45
export const UNTAP_WAVE_MIN_CARDS = 2

interface TapPose {
  rotation: number
  scale: number
}

const TAPPED_POSE: Record<'normal' | 'tilted', Record<'classic' | 'compact', TapPose>> = {
  normal: {
    classic: { rotation: 90, scale: 1 },
    compact: { rotation: 90, scale: 0.75 },
  },
  tilted: {
    classic: { rotation: 45, scale: 0.825 },
    compact: { rotation: 45, scale: 0.606 },
  },
}

function tappedPose(node: HTMLElement, tilted: boolean): TapPose {
  const style = tilted ? TAPPED_POSE.tilted : TAPPED_POSE.normal
  return node.classList.contains('is-compact') ? style.compact : style.classic
}

function cancelTransformTransitions(node: HTMLElement): void {
  node.getAnimations?.().forEach((animation) => {
    if ((animation as Animation & { transitionProperty?: string }).transitionProperty === 'transform') {
      animation.cancel()
    }
  })
}

/**
 * Arena-style left-to-right untap wave: cards snap upright with a subtle pop
 * and glint sparks, driven by a single GSAP timeline. Disables CSS `transition`
 * while GSAP owns `transform` so the browser transition never fights the wave.
 */
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

    const tl = fxTimeline()
    if (!tl) return

    untapped.forEach((node, index) => {
      cancelTransformTransitions(node)
      const from = tappedPose(node, tiltedTaps)
      const at = (index * UNTAP_WAVE_STAGGER_MS) / 1000
      const rise = (UNTAP_WAVE_MS * 0.65) / 1000
      const settle = (UNTAP_WAVE_MS * 0.35) / 1000

      tl.set(node, { transition: 'none' }, 0)
        .fromTo(
          node,
          { rotation: from.rotation, scale: from.scale },
          { rotation: 0, scale: 1.06, duration: rise, ease: ARENA_EASE.pop },
          at,
        )
        .to(
          node,
          { scale: 1, duration: settle, ease: ARENA_EASE.snapOut, clearProps: 'rotation,scale,transition' },
          at + rise,
        )

      const rect = node.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        tl.call(
          () => {
            vfx.sparkBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, 'W', {
              count: 6,
              speed: 120,
              size: 2.6,
              life: 0.25,
              gravity: 40,
            })
          },
          undefined,
          at + 0.04,
        )
      }
    })
  })
}
