import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ManaPoolView from './ManaPoolView'

describe('ManaPoolView', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders the six pips inline with counts and greys out zeros', () => {
    const { container } = render(
      <ManaPoolView pool={{ white: 0, blue: 1, black: 0, red: 2, green: 0, colorless: 0 }} />
    )
    expect(container.querySelector('[data-testid="mana-inline"]')).toBeTruthy()
    expect(container.querySelectorAll('.mana-inline-pip')).toHaveLength(6)
    const counts = Array.from(container.querySelectorAll('.mana-inline-count')).map((el) => el.textContent)
    expect(counts).toEqual(['0', '1', '0', '2', '0', '0'])
    expect(container.querySelectorAll('.mana-inline-pip.is-zero')).toHaveLength(4)
    expect(container.querySelector('button')).toBeNull()
  })

  it('makes non-zero pips clickable when canPay with onPay', () => {
    const onPay = vi.fn()
    const { container } = render(
      <ManaPoolView pool={{ white: 0, blue: 0, black: 0, red: 2, green: 0, colorless: 0 }} canPay onPay={onPay} />
    )
    const redBtn = container.querySelector('[data-testid="mana-pay-R"]')
    expect(redBtn?.tagName).toBe('BUTTON')
    fireEvent.click(redBtn!)
    expect(onPay).toHaveBeenCalledWith('red')
    expect(container.querySelector('[data-testid="mana-pay-W"]')).toBeNull()
  })

  it('renders nothing clickable for opponents', () => {
    const onPay = vi.fn()
    const { container } = render(
      <ManaPoolView pool={{ white: 3, blue: 0, black: 0, red: 0, green: 0, colorless: 0 }} onPay={onPay} />
    )
    expect(container.querySelector('button')).toBeNull()
  })
})
