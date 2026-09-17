import type { KeyboardEvent } from 'react'

/**
 * Región de la mesa donde Space está reservado al atajo global de juego
 * (pasar prioridad / confirmar). Dentro de ella las cartas clicables se
 * activan con Enter; fuera (diálogos, menús, lobby) Space sigue activando
 * el control como manda role=button.
 */
export const SPACE_PASS_REGION_SELECTOR = '[data-space-passes-priority]'

/**
 * Subárboles que apagan el atajo global de Space mientras están abiertos
 * (overlays de visor). Dentro de ellos Space vuelve a activar el control
 * enfocado (como en los diálogos) y el pass no dispara aunque el foco caiga
 * al `body` al clicar el fondo.
 */
export const SPACE_SHORTCUT_OFF_SELECTOR = '[data-space-shortcut-off]'

/**
 * Props de accesibilidad para un `div` clicable (role=button + foco por
 * teclado). Los divs con onClick sin esto son inoperables por teclado.
 */
export function clickableProps(onClick?: () => void): {
  role?: 'button'
  tabIndex?: number
  onKeyDown?: (e: KeyboardEvent) => void
} {
  if (!onClick) return {}
  return {
    role: 'button',
    tabIndex: 0,
    onKeyDown: (e) => {
      const el = e.currentTarget
      const inGameRegion =
        Boolean(el.closest(SPACE_PASS_REGION_SELECTOR)) && !el.closest(SPACE_SHORTCUT_OFF_SELECTOR)
      if (e.key === 'Enter' || (e.key === ' ' && !inGameRegion)) {
        e.preventDefault()
        onClick()
      }
    },
  }
}
