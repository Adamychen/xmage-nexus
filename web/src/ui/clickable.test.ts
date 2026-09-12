import { describe, expect, it, vi } from 'vitest'
import { clickableProps } from './clickable'

describe('clickableProps (AUDIT a11y)', () => {
  it('vacío sin handler', () => {
    expect(clickableProps()).toEqual({})
    expect(clickableProps(undefined)).toEqual({})
  })

  it('expone rol, foco y activación por Enter/Espacio', () => {
    const onClick = vi.fn()
    const props = clickableProps(onClick)
    expect(props.role).toBe('button')
    expect(props.tabIndex).toBe(0)
    props.onKeyDown?.({ key: 'Enter', preventDefault: vi.fn() } as never)
    expect(onClick).toHaveBeenCalledTimes(1)
    props.onKeyDown?.({ key: ' ', preventDefault: vi.fn() } as never)
    expect(onClick).toHaveBeenCalledTimes(2)
    props.onKeyDown?.({ key: 'Tab', preventDefault: vi.fn() } as never)
    expect(onClick).toHaveBeenCalledTimes(2)
  })
})
