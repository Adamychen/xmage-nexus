import { describe, expect, it, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import PlaneswalkerAbilityDialog from './PlaneswalkerAbilityDialog'
import type { FeedbackPrompt } from './feedback'

vi.mock('../net/commands', () => ({
  sendPlayerUUID: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock('../state/store', () => ({
  useStore: (selector: (s: unknown) => unknown) => selector({ game: { players: [{ battlefield: { pw1: { loyalty: '3' } } }] } }),
}))

describe('PlaneswalkerAbilityDialog', () => {
  it('renders loyalty deltas with colors and sends UUID', () => {
    const prompt: FeedbackPrompt = {
      method: 'GAME_CHOOSE_ABILITY',
      gameId: 'g1',
      title: 'Habilidad de Planeswalker',
      message: 'Activa una habilidad de Jace',
      mode: 'uuid',
      options: [
        { id: 'a1', label: '+2: Look at top', value: 'a1' },
        { id: 'a2', label: '-3: Draw 2', value: 'a2' },
        { id: 'a3', label: '-8: Win game', value: 'a3' },
      ],
      min: 1,
      max: 1,
      isPlaneswalkerAbility: true,
      loyaltyDeltas: [2, -3, -8],
    }
    const send = vi.fn((action: () => Promise<unknown>) => { void action(); })
    const { container } = render(<PlaneswalkerAbilityDialog prompt={prompt} send={send as never} busy={false} />)
    expect(container.textContent).toContain('PLANESWALKER')
    expect(container.textContent).toContain('+2')
    expect(container.textContent).toContain('-3')
    expect(container.textContent).toContain('Lealtad actual: 3')
    expect(container.textContent).toContain('→ 5')
    const btns = container.querySelectorAll('.pw-ability-btn')
    expect(btns.length).toBe(3)
    expect(btns[0].className).toContain('delta-pos')
    expect(btns[1].className).toContain('delta-neg')
    fireEvent.click(btns[0] as Element)
    expect(send).toHaveBeenCalled()
  })
})
