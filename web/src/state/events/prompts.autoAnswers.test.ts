import { describe, expect, it, beforeEach, vi } from 'vitest'
import { handleGameAsk } from './prompts'
import { getState, setState } from '../state'
import * as cmds from '../../net/commands'

vi.mock('../../net/commands', () => ({
  sendPlayerBoolean: vi.fn().mockResolvedValue({ ok: true }),
}))

const sendPlayerBoolean = vi.mocked(cmds.sendPlayerBoolean)

beforeEach(() => {
  vi.clearAllMocks()
  setState({ feedback: null, game: null, gameId: null })
})

function withRules(patterns: { pattern: string; answer: boolean }[]) {
  setState({
    settings: {
      ...getState().settings,
      autoAnswers: patterns.map((entry, index) => ({ id: `auto-${index}`, ...entry })),
    },
  })
}

describe('handleGameAsk auto-answers', () => {
  it('answers silently when a rule matches and leaves no dialog', () => {
    withRules([{ pattern: 'would you like to draw a card?', answer: true }])
    handleGameAsk('GAME_ASK', { message: 'Would you like to draw a card?' }, 'g1', getState())
    expect(sendPlayerBoolean).toHaveBeenCalledWith(true, 'g1')
    expect(getState().feedback).toBeNull()
  })

  it('shows the dialog when nothing matches', () => {
    withRules([{ pattern: 'would you like to draw a card?', answer: true }])
    handleGameAsk('GAME_ASK', { message: 'Pay 2 life?' }, 'g1', getState())
    expect(sendPlayerBoolean).not.toHaveBeenCalled()
    expect(getState().feedback?.method).toBe('GAME_ASK')
  })

  it('never auto-answers voting prompts even with a matching rule', () => {
    withRules([{ pattern: 'vote now', answer: true }])
    handleGameAsk('GAME_ASK', { message: 'Vote now' }, 'g1', getState())
    expect(sendPlayerBoolean).not.toHaveBeenCalled()
    expect(getState().feedback?.method).toBe('GAME_ASK')
  })
})
