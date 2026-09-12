import type { KeyboardEvent } from 'react'

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
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onClick()
      }
    },
  }
}
