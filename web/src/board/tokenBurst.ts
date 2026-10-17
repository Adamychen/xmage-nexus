import { fxMotionAllowed, fxMotionDuration } from './fx'
import type { ManaColor } from './impactFx'

export const TOKEN_BURST_MS = 320
export const TOKEN_BURST_DOTS = 6

export function spawnTokenBurst(rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>, color: ManaColor | null): void {
  if (typeof document === 'undefined' || !fxMotionAllowed() || rect.width <= 0) return
  const ms = fxMotionDuration(TOKEN_BURST_MS)
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const radius = Math.max(rect.width, rect.height) * 0.9
  const turn = Math.random() * Math.PI * 2
  for (let i = 0; i < TOKEN_BURST_DOTS; i++) {
    const angle = turn + (i / TOKEN_BURST_DOTS) * Math.PI * 2
    const dot = document.createElement('div')
    dot.className = `token-burst-dot token-burst-dot--${color ?? 'c'}`
    dot.style.left = `${cx}px`
    dot.style.top = `${cy}px`
    dot.style.setProperty('--burst-dx', `${Math.cos(angle) * radius}px`)
    dot.style.setProperty('--burst-dy', `${Math.sin(angle) * radius}px`)
    dot.style.setProperty('--burst-ms', `${ms}ms`)
    document.body.appendChild(dot)
    dot.addEventListener('animationend', () => dot.remove())
    setTimeout(() => dot.remove(), ms + 100)
  }
}
