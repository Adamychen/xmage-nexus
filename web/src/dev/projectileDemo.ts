import { spawnProjectile } from '../board/projectileFx'

export function replayProjectileDemo(): void {
  const from = document.querySelector<HTMLElement>('[data-fx-from]')
  const to = document.querySelector<HTMLElement>('[data-fx-to]')
  if (!from || !to) return
  spawnProjectile(from.getBoundingClientRect(), () => to.getBoundingClientRect(), ['u'])
}
