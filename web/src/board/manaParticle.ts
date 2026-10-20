import { fxMotionAllowed, fxMotionDuration } from './fx'
import { symbolToSvgPath } from '../decks/ArenaManaSymbols'

export const MANA_PARTICLE_MS = 400
export const MANA_POOL_LAND_CLASS = 'mana-pool-landed'

export type ManaSide = 'my' | 'opp'

export function manaPoolElement(side: ManaSide): HTMLElement | null {
  if (typeof document === 'undefined') return null
  const el = document.querySelector<HTMLElement>(`.resource-bar.${side} .resource-mana-wrap, .resource-bar-pool[data-side="${side}"]`)
  return el && el.getBoundingClientRect().width > 0 ? el : null
}

export function spawnManaParticle(from: DOMRect, pool: HTMLElement, color: string): void {
  flyManaOrb(from, pool.getBoundingClientRect(), color, () => landManaPool(pool))
}

export function flyManaOrb(from: DOMRect, to: DOMRect, color: string, onLand?: () => void): void {
  if (typeof document === 'undefined' || !fxMotionAllowed()) return
  const fromX = from.left + from.width / 2
  const fromY = from.top + from.height / 2
  const toX = to.left + to.width / 2
  const toY = to.top + to.height / 2
  const ms = fxMotionDuration(MANA_PARTICLE_MS)
  const particle = document.createElement('div')
  particle.className = `mana-particle mana-particle--${color}`
  const symbol = document.createElement('img')
  symbol.src = symbolToSvgPath(color)
  symbol.alt = ''
  symbol.draggable = false
  symbol.onerror = () => {
    const letter = document.createElement('span')
    letter.textContent = color
    symbol.replaceWith(letter)
  }
  particle.appendChild(symbol)
  particle.style.left = `${fromX}px`
  particle.style.top = `${fromY}px`
  particle.style.setProperty('--particle-dx', `${toX - fromX}px`)
  particle.style.setProperty('--particle-dy', `${toY - fromY}px`)
  particle.style.setProperty('--particle-ms', `${ms}ms`)
  document.body.appendChild(particle)
  setTimeout(() => {
    particle.remove()
    onLand?.()
  }, ms)
}

function landManaPool(pool: HTMLElement): void {
  pool.classList.remove(MANA_POOL_LAND_CLASS)
  void pool.offsetWidth
  pool.classList.add(MANA_POOL_LAND_CLASS)
  pool.addEventListener('animationend', () => pool.classList.remove(MANA_POOL_LAND_CLASS), { once: true })
}
