// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import ActionButton from './ActionButton'
import { makeGameView, makePlayer } from '../__fixtures__/gameViews'
import { setLanguage } from '../i18n'

const SIM_NAME = 'sim-000040'

const alice = (hasPriority: boolean) =>
  makePlayer({ playerId: 'p1', name: 'Alice', controlled: true, hasPriority })
const sim = (hasPriority: boolean) =>
  makePlayer({ playerId: 'p2', name: SIM_NAME, hasPriority })

function renderButton(game: ReturnType<typeof makeGameView>, canPass: boolean) {
  return render(
    <ActionButton
      game={game}
      feedback={null}
      gameId="g-1"
      canPass={canPass}
      onPass={vi.fn()}
      onSkip={vi.fn()}
    />,
  )
}

describe('ActionButton con prioridad controlada', () => {
  beforeEach(() => {
    setLanguage('en')
  })
  afterEach(() => {
    cleanup()
  })

  it('habilita el paso y muestra "You control <name>\'s turn"', () => {
    const game = makeGameView({
      players: [alice(false), sim(true)],
      opponentHands: { [SIM_NAME]: { 'oh-1': { id: 'oh-1', name: 'Lightning Bolt' } } },
      activePlayerName: SIM_NAME,
      priorityPlayerName: SIM_NAME,
    })
    const { getByRole, getByText } = renderButton(game, true)
    const btn = getByRole('button', { name: /Pass Priority/ }) as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    expect(getByText("You control sim-000040's turn")).not.toBeNull()
  })

  it('without control, foreign priority shows who we are waiting for', () => {
    const game = makeGameView({
      players: [alice(false), sim(true)],
      activePlayerName: SIM_NAME,
      priorityPlayerName: SIM_NAME,
    })
    const { getByRole, getByTestId } = renderButton(game, false)
    const btn = getByRole('button', { name: new RegExp(`Waiting for ${SIM_NAME}`) }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(getByTestId('waiting-clock').textContent).toContain('thinking 0:00')
  })

  it('con mi propia prioridad no aparece el sublabel de control', () => {
    const game = makeGameView({
      players: [alice(true), sim(false)],
      opponentHands: { [SIM_NAME]: { 'oh-1': { id: 'oh-1', name: 'Lightning Bolt' } } },
      activePlayerName: 'Alice',
      priorityPlayerName: 'Alice',
    })
    const { queryByText, getByRole } = renderButton(game, true)
    expect(getByRole('button', { name: /Pass Priority/ })).not.toBeNull()
    expect(queryByText(/You control/)).toBeNull()
  })
})
