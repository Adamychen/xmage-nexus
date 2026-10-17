import { soundManager } from './soundManager'

const CONTROL = 'button, [role="button"]'
const SILENT_ZONE = '[data-no-click-sound], .board, .game-board, .card-slot, .player-info-bar'
const MIN_INTERVAL_MS = 60

function isDisabled(el: Element): boolean {
  return (el as HTMLButtonElement).disabled === true || el.getAttribute('aria-disabled') === 'true'
}

export function installUiClickSound(): () => void {
  let lastAt = -Infinity
  const onClick = (e: MouseEvent) => {
    if (e.detail === 0) return
    const target = e.target
    if (!(target instanceof Element)) return
    const control = target.closest(CONTROL)
    if (!control || isDisabled(control)) return
    if (control.closest(SILENT_ZONE) || target.closest(SILENT_ZONE)) return
    if (soundManager.isUiClickClaimed()) return
    const now = Date.now()
    if (now - lastAt < MIN_INTERVAL_MS) return
    lastAt = now
    soundManager.play('ui_click', 'ui')
  }
  document.addEventListener('click', onClick)
  return () => document.removeEventListener('click', onClick)
}
