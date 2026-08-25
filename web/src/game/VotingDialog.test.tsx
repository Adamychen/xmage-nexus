import { describe, expect, it, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import VotingDialog from './VotingDialog'
import type { FeedbackPrompt } from './feedback'

vi.mock('../net/commands', () => ({
  sendPlayerBoolean: vi.fn().mockResolvedValue({ ok: true }),
  sendPlayerString: vi.fn().mockResolvedValue({ ok: true }),
}))

describe('VotingDialog', () => {
  it('renders two voting options and sends boolean', () => {
    const prompt: FeedbackPrompt = {
      method: 'GAME_ASK',
      gameId: 'g1',
      title: 'Votación',
      message: 'Vote, step 1 of 2',
      mode: 'boolean',
      options: [
        { id: 'a', label: 'Strength', value: 'true' },
        { id: 'b', label: 'Numbers', value: 'false' },
      ],
      min: 0,
      max: 1,
      isVoting: true,
    }
    const send = vi.fn((action: () => Promise<unknown>) => { void action(); })
    const { container } = render(<VotingDialog prompt={prompt} send={send as never} busy={false} />)
    expect(container.textContent).toContain('VOTACIÓN')
    expect(container.textContent).toContain('Strength')
    expect(container.textContent).toContain('Numbers')
    const btns = container.querySelectorAll('.voting-btn')
    expect(btns.length).toBe(2)
    fireEvent.click(btns[0] as Element)
    expect(send).toHaveBeenCalled()
  })

  it('shows step badge when message contains step', () => {
    const prompt: FeedbackPrompt = {
      method: 'GAME_ASK',
      gameId: 'g1',
      title: 'Votación',
      message: 'Vote, step 2 of 3 for Trap the Trespassers',
      mode: 'boolean',
      options: [
        { id: 'a', label: 'Yes', value: 'true' },
        { id: 'b', label: 'No', value: 'false' },
      ],
      min: 0,
      max: 1,
      isVoting: true,
    }
    const { container } = render(<VotingDialog prompt={prompt} send={vi.fn() as never} busy={false} />)
    expect(container.textContent).toContain('2/3')
  })
})
