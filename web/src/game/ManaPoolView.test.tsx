import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ManaPoolView from './ManaPoolView'

describe('ManaPoolView', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders only the colours holding mana outside of payment', () => {
    const { container } = render(
      <ManaPoolView pool={{ white: 0, blue: 1, black: 0, red: 2, green: 0, colorless: 0 }} />
    )
    expect(container.querySelector('[data-testid="mana-inline"]')).toBeTruthy()
    expect(container.querySelectorAll('.mana-inline-pip')).toHaveLength(2)
    const counts = Array.from(container.querySelectorAll('.mana-inline-count')).map((el) => el.textContent)
    expect(counts).toEqual(['1', '2'])
    expect(container.querySelector('button')).toBeNull()
  })

  it('keeps the six pips with showAll (mana payment in progress)', () => {
    const { container } = render(
      <ManaPoolView pool={{ white: 0, blue: 1, black: 0, red: 2, green: 0, colorless: 0 }} showAll canPay onPay={() => {}} />
    )
    expect(container.querySelectorAll('.mana-inline-pip')).toHaveLength(6)
    // los ceros siguen atenuados (no pagables), pero visibles durante el pago
    expect(container.querySelectorAll('.mana-inline-pip.is-zero')).toHaveLength(4)
  })

  it('canPay alone does NOT force the six pips (es true toda la partida)', () => {
    const { container } = render(
      <ManaPoolView pool={{ white: 0, blue: 1, black: 0, red: 2, green: 0, colorless: 0 }} canPay onPay={() => {}} />
    )
    expect(container.querySelectorAll('.mana-inline-pip')).toHaveLength(2)
  })

  it('renders a placeholder when the pool is empty', () => {
    const { container } = render(<ManaPoolView pool={{}} />)
    expect(container.querySelectorAll('.mana-inline-pip')).toHaveLength(0)
    expect(container.querySelector('.mana-inline-empty')).toBeTruthy()
    expect(container.querySelector('.mana-inline.is-empty')).toBeTruthy()
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
