import { describe, expect, it, vi } from 'vitest'
import { clickableProps } from './clickable'

function keyProps(key: string, currentTarget: HTMLElement) {
  return { key, currentTarget, preventDefault: vi.fn() } as never
}

describe('clickableProps (AUDIT a11y)', () => {
  it('vacío sin handler', () => {
    expect(clickableProps()).toEqual({})
    expect(clickableProps(undefined)).toEqual({})
  })

  it('expone rol, foco y activación por Enter/Espacio', () => {
    const onClick = vi.fn()
    const props = clickableProps(onClick)
    const node = document.createElement('div')
    expect(props.role).toBe('button')
    expect(props.tabIndex).toBe(0)
    props.onKeyDown?.(keyProps('Enter', node))
    expect(onClick).toHaveBeenCalledTimes(1)
    props.onKeyDown?.(keyProps(' ', node))
    expect(onClick).toHaveBeenCalledTimes(2)
    props.onKeyDown?.(keyProps('Tab', node))
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it('dentro de la región de juego Space no activa el control (Enter sí)', () => {
    const onClick = vi.fn()
    const props = clickableProps(onClick)
    const region = document.createElement('div')
    region.setAttribute('data-space-passes-priority', 'true')
    const node = document.createElement('div')
    region.appendChild(node)
    const preventDefault = vi.fn()
    props.onKeyDown?.({ key: ' ', currentTarget: node, preventDefault } as never)
    expect(onClick).not.toHaveBeenCalled()
    expect(preventDefault).not.toHaveBeenCalled()
    props.onKeyDown?.({ key: 'Enter', currentTarget: node, preventDefault } as never)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('en overlays con el atajo apagado Space vuelve a activar (como en diálogos)', () => {
    const onClick = vi.fn()
    const props = clickableProps(onClick)
    const region = document.createElement('div')
    region.setAttribute('data-space-passes-priority', 'true')
    const overlay = document.createElement('div')
    overlay.setAttribute('data-space-shortcut-off', 'true')
    region.appendChild(overlay)
    const node = document.createElement('div')
    overlay.appendChild(node)
    const preventDefault = vi.fn()
    props.onKeyDown?.({ key: ' ', currentTarget: node, preventDefault } as never)
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(preventDefault).toHaveBeenCalled()
  })
})
