import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handleGameAsk, handleGameTarget } from './prompts'
import { handleMessage } from '../eventHandler'
import { getState, listeners, setState } from '../state'
import { parseFeedback } from '../../game/feedback'
import type { FeedbackPrompt } from '../../game/feedback'
import { LIBRARY_PLAN_IDLE_MS, endLibraryPlan, startLibraryPlan } from '../libraryPlanRunner'
import * as cmds from '../../net/commands'

vi.mock('../../net/commands', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../net/commands')>()),
  sendPlayerUUID: vi.fn().mockResolvedValue({ ok: true }),
  sendPlayerBoolean: vi.fn().mockResolvedValue({ ok: true }),
}))

const sendPlayerUUID = vi.mocked(cmds.sendPlayerUUID)
const sendPlayerBoolean = vi.mocked(cmds.sendPlayerBoolean)

const SURVEIL = 'Select card(s) to PUT into your GRAVEYARD (Surveil)'
const GRAVE_ASK = 'Choose the order in which the cards go to the graveyard?'
const TOP_ORDER = 'Select a card ORDER to put on the TOP of your library (last one chosen will be topmost)'

function cardsView(ids: string[]) {
  return Object.fromEntries(ids.map((id) => [id, { id, name: `Card ${id}` }]))
}

function surveilData(ids: string[], chosen: string[] = [], message = SURVEIL) {
  return {
    message,
    targets: ids,
    cardsView1: cardsView(ids),
    min: 0,
    max: ids.length,
    options: chosen.length ? { chosenTargets: chosen } : {},
  }
}

function surveilPrompt(ids: string[], gameId = 'g1'): FeedbackPrompt {
  const prompt = parseFeedback('GAME_TARGET', gameId, surveilData(ids))
  if (!prompt) throw new Error('surveil pick did not parse')
  return prompt
}

beforeEach(() => {
  vi.clearAllMocks()
  endLibraryPlan()
  setState({
    feedback: null,
    game: null,
    gameId: 'g1',
    phase: 'game',
    settings: { ...getState().settings, autoAnswers: [] },
  })
})

afterEach(() => {
  endLibraryPlan()
  vi.useRealTimers()
})

describe('library plan runner', () => {
  it('PRM-18: starting a plan answers the open surveil pick and hides it', () => {
    const prompt = surveilPrompt(['a', 'b', 'c'])
    setState({ feedback: prompt })
    startLibraryPlan(prompt, { mode: 'surveil', top: ['a', 'c'], away: ['b'] })
    expect(sendPlayerUUID).toHaveBeenCalledWith('b', 'g1')
    expect(getState().feedback).toBeNull()
    expect(getState().libraryPlan).not.toBeNull()
    expect(getState().libraryPrompt).toBe(prompt)
  })

  it('PRM-18: the re-asked pick is answered with Done and stays hidden', () => {
    startLibraryPlan(surveilPrompt(['a', 'b', 'c']), { mode: 'surveil', top: ['a', 'c'], away: ['b'] })
    handleGameTarget('GAME_TARGET', surveilData(['a', 'b', 'c'], ['b']), 'g1', getState())
    expect(sendPlayerBoolean).toHaveBeenCalledWith(false, 'g1')
    expect(getState().feedback).toBeNull()
    expect(getState().libraryPlan).not.toBeNull()
  })

  it('PRM-18: a re-asked pick through the event handler never opens the dialog', () => {
    startLibraryPlan(surveilPrompt(['a', 'b', 'c']), { mode: 'surveil', top: ['a', 'c'], away: ['b'] })
    let opened = false
    const watch = () => { if (getState().feedback) opened = true }
    listeners.add(watch)
    try {
      handleMessage({ type: 'event', method: 'GAME_TARGET', objectId: 'g1', data: surveilData(['a', 'b', 'c'], ['b']) } as never)
    } finally {
      listeners.delete(watch)
    }
    expect(sendPlayerBoolean).toHaveBeenCalledWith(false, 'g1')
    expect(opened).toBe(false)
    expect(getState().feedback).toBeNull()
  })

  it('PRM-18: a foreign prompt mid-chain is shown and ends the plan', () => {
    startLibraryPlan(surveilPrompt(['a', 'b', 'c']), { mode: 'surveil', top: ['a', 'c'], away: ['b'] })
    vi.clearAllMocks()
    handleGameTarget('GAME_TARGET', { message: 'Select target creature', targets: ['x'], min: 1, max: 1 }, 'g1', getState())
    expect(sendPlayerUUID).not.toHaveBeenCalled()
    expect(sendPlayerBoolean).not.toHaveBeenCalled()
    expect(getState().feedback?.message).toBe('Select target creature')
    expect(getState().libraryPlan).toBeNull()
    expect(getState().libraryPrompt).toBeNull()
  })

  it('PRM-18: a plan never answers a prompt of another game', () => {
    startLibraryPlan(surveilPrompt(['a', 'b', 'c']), { mode: 'surveil', top: ['a', 'c'], away: ['b'] })
    vi.clearAllMocks()
    handleGameTarget('GAME_TARGET', surveilData(['a', 'b', 'c'], ['b']), 'g2', getState())
    expect(sendPlayerUUID).not.toHaveBeenCalled()
    expect(sendPlayerBoolean).not.toHaveBeenCalled()
    expect(getState().feedback?.gameId).toBe('g2')
    expect(getState().libraryPlan).toBeNull()
  })

  it('PRM-18: a GAME_SELECT ends the plan', () => {
    startLibraryPlan(surveilPrompt(['a', 'b', 'c']), { mode: 'surveil', top: ['a', 'c'], away: ['b'] })
    handleMessage({ type: 'event', method: 'GAME_SELECT', objectId: 'g1', data: { message: 'Play spells' } } as never)
    expect(getState().libraryPlan).toBeNull()
    expect(getState().libraryPrompt).toBeNull()
  })

  it('PRM-18: a plan with no prompt for the idle time ends', () => {
    vi.useFakeTimers()
    startLibraryPlan(surveilPrompt(['a', 'b', 'c']), { mode: 'surveil', top: ['a', 'c'], away: ['b'] })
    vi.advanceTimersByTime(LIBRARY_PLAN_IDLE_MS - 1)
    handleGameTarget('GAME_TARGET', surveilData(['a', 'b', 'c'], ['b']), 'g1', getState())
    vi.advanceTimersByTime(LIBRARY_PLAN_IDLE_MS - 1)
    expect(getState().libraryPlan).not.toBeNull()
    vi.advanceTimersByTime(1)
    expect(getState().libraryPlan).toBeNull()
    expect(getState().libraryPrompt).toBeNull()
  })

  it('PRM-18: a settled plan ends right after its last answer', () => {
    vi.useFakeTimers()
    startLibraryPlan(surveilPrompt(['a', 'b', 'c']), { mode: 'surveil', top: ['a', 'c'], away: ['b'] })
    handleGameTarget('GAME_TARGET', surveilData(['a', 'b', 'c'], ['b']), 'g1', getState())
    expect(getState().libraryPlan).not.toBeNull()
    handleGameTarget('GAME_TARGET', surveilData(['a', 'c'], [], TOP_ORDER), 'g1', getState())
    expect(sendPlayerUUID).toHaveBeenLastCalledWith('c', 'g1')
    expect(getState().feedback).toBeNull()
    expect(getState().libraryPlan).toBeNull()
    expect(getState().libraryPrompt).toBeNull()
  })

  it('PRM-18: the graveyard order ask is answered by the plan before the auto-answer rules', () => {
    setState({ settings: { ...getState().settings, autoAnswers: [{ id: 'auto-0', pattern: GRAVE_ASK.toLowerCase(), answer: false }] } })
    startLibraryPlan(surveilPrompt(['a', 'b', 'c']), { mode: 'surveil', top: ['a'], away: ['b', 'c'] })
    vi.clearAllMocks()
    handleGameAsk('GAME_ASK', { message: GRAVE_ASK }, 'g1', getState())
    expect(sendPlayerBoolean).toHaveBeenCalledTimes(1)
    expect(sendPlayerBoolean).toHaveBeenCalledWith(true, 'g1')
    expect(getState().feedback).toBeNull()
    expect(getState().libraryPlan).not.toBeNull()
  })

  it('PRM-18: ending the plan clears the plan and its prompt', () => {
    startLibraryPlan(surveilPrompt(['a', 'b', 'c']), { mode: 'surveil', top: ['a', 'c'], away: ['b'] })
    endLibraryPlan()
    expect(getState().libraryPlan).toBeNull()
    expect(getState().libraryPrompt).toBeNull()
  })
})
