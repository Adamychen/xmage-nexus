import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import VotingDialog from './VotingDialog'
import { setLanguage } from '../i18n'
import type { FeedbackPrompt } from './feedback'
import * as cmds from '../net/commands'

vi.mock('../net/commands', () => ({
  sendPlayerBoolean: vi.fn().mockResolvedValue({ ok: true }),
  sendPlayerString: vi.fn().mockResolvedValue({ ok: true }),
  sendPlayerUUID: vi.fn().mockResolvedValue({ ok: true }),
}))

afterEach(() => {
  setLanguage('es')
})

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

  it('shows a localized step kicker and links the hint via aria-describedby', () => {
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
    setLanguage('es')
    const esRender = render(<VotingDialog prompt={prompt} send={vi.fn() as never} busy={false} />)
    expect(esRender.container.textContent).toContain('Paso 2 de 3')
    const esSection = esRender.container.querySelector('section[role="dialog"]')
    expect(esSection?.getAttribute('aria-describedby')).toBe('voting-hint')
    expect(esRender.container.querySelector('#voting-hint')?.textContent).toContain('Tu voto es secreto')
    esRender.unmount()

    setLanguage('en')
    const enRender = render(<VotingDialog prompt={prompt} send={vi.fn() as never} busy={false} />)
    expect(enRender.container.textContent).toContain('Step 2 of 3')
    enRender.unmount()
  })

  it('sends sendPlayerUUID when the vote arrives as GAME_TARGET (single-candidate vote)', () => {
    const prompt: FeedbackPrompt = {
      method: 'GAME_TARGET',
      gameId: 'g1',
      title: 'Votación',
      message: 'Vote for a card to exile',
      mode: 'uuid',
      options: [
        { id: 'p1', label: 'Elvish Mystic', value: 'perm-1' },
      ],
      min: 1,
      max: 1,
      isVoting: true,
    }
    const send = vi.fn((action: () => Promise<unknown>) => { void action(); })
    const { container } = render(<VotingDialog prompt={prompt} send={send as never} busy={false} />)
    const btn = container.querySelector('.voting-btn') as Element
    fireEvent.click(btn)
    expect(cmds.sendPlayerUUID).toHaveBeenCalledWith('perm-1', 'g1')
  })

  it('localizes recognizable server message and option labels like sibling dialogs', () => {
    const prompt: FeedbackPrompt = {
      method: 'GAME_ASK',
      gameId: 'g1',
      title: 'Votación',
      message: 'Choose a player',
      mode: 'boolean',
      options: [
        { id: 'a', label: 'Yes', value: 'true' },
        { id: 'b', label: 'No', value: 'false' },
      ],
      min: 0,
      max: 1,
      isVoting: true,
    }
    setLanguage('es')
    const { container } = render(<VotingDialog prompt={prompt} send={vi.fn() as never} busy={false} />)
    // 'Choose a player' matches a localizeServerMessage pattern -> translated, not raw English.
    expect(container.textContent).not.toContain('Choose a player')
    // 'Yes'/'No' match localizeOptionLabel -> translated to Spanish, same as GenericDialog's options.
    expect(container.textContent).toContain('Sí')
    expect(container.textContent).toContain('No')
  })
})
