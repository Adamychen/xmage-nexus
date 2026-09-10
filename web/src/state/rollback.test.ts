import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeGameView } from '../__fixtures__/gameViews'
import type { FeedbackPrompt } from '../game/feedback'
import { getState, setState } from './state'
import { handleMessage, requestRollback } from './store'
import { reset } from './gateway'
import * as cmds from '../net/commands'

vi.mock('../net/commands', () => ({
  setGateway: vi.fn(),
  getGateway: vi.fn(),
  joinGame: vi.fn(),
  getGameChatId: vi.fn().mockResolvedValue(undefined),
  joinChat: vi.fn(),
  sendPlayerAction: vi.fn().mockResolvedValue({ ok: true }),
  sendPlayerBoolean: vi.fn(),
  sendPlayerUUID: vi.fn(),
}))

const STALE_FEEDBACK = { method: 'GAME_SELECT', message: 'prioridad vieja' } as unknown as FeedbackPrompt
const ROLLBACK_CHAT = (message: string) => ({
  type: 'event',
  method: 'CHATMESSAGE',
  messageId: 2,
  objectId: 'c-9',
  data: { chatId: 'c-9', username: '', message, messageType: 'GAME' },
} as const)

function acceptTurn5() {
  const t5 = makeGameView({ turn: 5, phase: 'POSTCOMBAT_MAIN', step: 'POSTCOMBAT_MAIN' })
  handleMessage({ type: 'event', method: 'GAME_UPDATE', messageId: 1, objectId: 'g-9', data: t5 })
  return t5
}

describe('rollback del servidor', () => {
  beforeEach(() => {
    reset()
    vi.clearAllMocks()
  })

  it('acepta la vista restaurada tras el anuncio y limpia la UI pre-rollback', () => {
    const t5 = acceptTurn5()
    setState({
      feedback: STALE_FEEDBACK,
      playableIds: ['c-1'],
      playableWindow: { turn: 5, phase: 'POSTCOMBAT_MAIN' },
      combat: { mode: 'attack', selectable: [], special: false, chosen: [] },
    })
    handleMessage({
      type: 'event',
      method: 'GAME_UPDATE_AND_INFORM',
      messageId: 2,
      objectId: 'g-9',
      data: { gameView: t5, message: "Player request: Rolling back to start of turn 3" },
    })
    expect(getState().rollbackPendingFor).toBe('g-9')

    const t3 = makeGameView({ turn: 3, phase: 'PRECOMBAT_MAIN', step: 'UPKEEP' })
    handleMessage({ type: 'event', method: 'GAME_UPDATE', messageId: 3, objectId: 'g-9', data: t3 })

    const s = getState()
    expect(s.game?.turn).toBe(3)
    expect(s.feedback).toBeNull()
    expect(s.playableIds).toEqual([])
    expect(s.playableWindow).toBeNull()
    expect(s.combat).toBeNull()
    expect(s.rollbackPendingFor).toBeNull()
    expect(s.log[s.log.length - 1]?.text).toMatch(/Rollback aplicado/)
  })

  it('el anuncio también llega por GAME_INFORM', () => {
    acceptTurn5()
    handleMessage({
      type: 'event',
      method: 'GAME_INFORM',
      messageId: 2,
      objectId: 'g-9',
      data: { message: "<font color='red'>Player request: Rolling back to start of turn 5</font>" },
    })
    const t5start = makeGameView({ turn: 5, phase: 'PRECOMBAT_MAIN', step: 'UPKEEP' })
    handleMessage({ type: 'event', method: 'GAME_UPDATE', messageId: 3, objectId: 'g-9', data: t5start })
    expect(getState().game?.step).toBe('UPKEEP')
    expect(getState().rollbackPendingFor).toBeNull()
  })

  it('el anuncio también llega por el chat de la partida (única vía a jugadores)', () => {
    acceptTurn5()
    handleMessage(ROLLBACK_CHAT("Player request: Rolling back to start of turn 3"))
    expect(getState().rollbackPendingFor).toBe('g-9')
    const t3 = makeGameView({ turn: 3, phase: 'PRECOMBAT_MAIN', step: 'UPKEEP' })
    handleMessage({ type: 'event', method: 'GAME_UPDATE', messageId: 3, objectId: 'g-9', data: t3 })
    expect(getState().game?.turn).toBe(3)
    expect(getState().rollbackPendingFor).toBeNull()
  })

  it('pedir el rollback arma la espera aunque el aviso llegue tarde o nunca', async () => {
    acceptTurn5()
    await requestRollback('g-9', 2)
    expect(cmds.sendPlayerAction).toHaveBeenCalledWith('ROLLBACK_TURNS', 'g-9', 2)
    expect(getState().rollbackPendingFor).toBe('g-9')
    const t3 = makeGameView({ turn: 3, phase: 'PRECOMBAT_MAIN', step: 'UPKEEP' })
    handleMessage({ type: 'event', method: 'GAME_UPDATE', messageId: 3, objectId: 'g-9', data: t3 })
    expect(getState().game?.turn).toBe(3)
    expect(getState().log[getState().log.length - 1]?.text).toMatch(/Rollback aplicado/)
  })

  it('la denegación del servidor desarma la espera y la vista vieja se sigue descartando', async () => {
    const t5 = acceptTurn5()
    setState({ playableIds: ['c-1'] })
    await requestRollback('g-9', 1)
    expect(getState().rollbackPendingFor).toBe('g-9')
    handleMessage(ROLLBACK_CHAT("Rollback request denied by <font color='red'>Bob</font>"))
    expect(getState().rollbackPendingFor).toBeNull()
    const t3 = makeGameView({ turn: 3, phase: 'PRECOMBAT_MAIN', step: 'UPKEEP' })
    handleMessage({ type: 'event', method: 'GAME_UPDATE', messageId: 3, objectId: 'g-9', data: t3 })
    expect(getState().game).toBe(t5)
    expect(getState().playableIds).toEqual(['c-1'])
  })

  it('sin nada pendiente sigue descartando vistas viejas (no pisa el estado)', () => {
    const t5 = acceptTurn5()
    setState({ playableIds: ['c-1'] })
    const t3 = makeGameView({ turn: 3, phase: 'PRECOMBAT_MAIN', step: 'UPKEEP' })
    handleMessage({ type: 'event', method: 'GAME_UPDATE', messageId: 2, objectId: 'g-9', data: t3 })
    expect(getState().game).toBe(t5)
    expect(getState().playableIds).toEqual(['c-1'])
    expect(getState().rollbackPendingFor).toBeNull()
  })
})
