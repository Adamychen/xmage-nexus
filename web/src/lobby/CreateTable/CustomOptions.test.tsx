import { render, cleanup, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'
import CustomOptions from './CustomOptions'

const stubForm = (over: Record<string, unknown> = {}) => ({
  gameType: 'Commander Free For All',
  deckType: 'Variant Magic - Commander',
  mulliganType: 'GAME_DEFAULT',
  setMulliganType: vi.fn(),
  customStartLifeEnabled: false,
  setCustomStartLifeEnabled: vi.fn(),
  customStartLife: 20,
  setCustomStartLife: vi.fn(),
  customStartHandSizeEnabled: false,
  setCustomStartHandSizeEnabled: vi.fn(),
  customStartHandSize: 7,
  setCustomStartHandSize: vi.fn(),
  planeChase: false,
  setPlaneChase: vi.fn(),
  ...over,
}) as any

const lifeInput = (container: HTMLElement) => container.querySelectorAll<HTMLInputElement>('.custom-number-input')[0]
const lifeToggle = (container: HTMLElement) => container.querySelectorAll<HTMLInputElement>('.custom-number input[type="checkbox"]')[0]

describe('CustomOptions', () => {
  afterEach(() => cleanup())

  it('LBY-15: with the custom life off, shows the life the format starts with', () => {
    const { container } = render(<CustomOptions form={stubForm()} />)
    expect(lifeInput(container).value).toBe('40')
    expect(lifeInput(container).disabled).toBe(true)
  })

  it('LBY-15: follows the deck type override', () => {
    const { container } = render(<CustomOptions form={stubForm({ deckType: 'Variant Magic - Duel Commander' })} />)
    expect(lifeInput(container).value).toBe('30')
  })

  it('LBY-15: an unknown game type shows no number, only the format-default placeholder', () => {
    const { container } = render(<CustomOptions form={stubForm({ gameType: 'Some Future Variant' })} />)
    expect(lifeInput(container).value).toBe('')
    expect(lifeInput(container).placeholder).not.toBe('')
  })

  it('LBY-15: turning the custom life on starts from the format life', () => {
    const form = stubForm()
    const { container } = render(<CustomOptions form={form} />)
    fireEvent.click(lifeToggle(container))
    expect(form.setCustomStartLife).toHaveBeenCalledWith(40)
    expect(form.setCustomStartLifeEnabled).toHaveBeenCalledWith(true)
  })

  it('LBY-15: with the custom life on, shows the chosen value', () => {
    const { container } = render(<CustomOptions form={stubForm({ customStartLifeEnabled: true, customStartLife: 25 })} />)
    expect(lifeInput(container).value).toBe('25')
    expect(lifeInput(container).disabled).toBe(false)
  })
})
