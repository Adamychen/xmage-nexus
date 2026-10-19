import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import CommanderSeatMatrix from './CommanderSeatMatrix'
import { resetCommanderMemory } from '../board/commanders'
import { commanderDamageRule, commanderInfoRule, makeCard, makeGameView, makePlayer } from '../__fixtures__/gameViews'

function commander(id: string, name: string, damage: Array<[number, string]>) {
  return makeCard({ id, name, mageObjectType: 'COMMANDER', rules: [commanderInfoRule(0), ...damage.map(([n, who]) => commanderDamageRule(n, who))] })
}

function pod() {
  return makeGameView({
    players: [
      makePlayer({ playerId: 'a', name: 'Adam', controlled: true, commandList: [commander('ca', 'Korvold', [[7, 'Tobias']])] }),
      makePlayer({ playerId: 'k', name: 'Kira', commandList: [commander('k1', 'Thrasios', [[5, 'Adam']]), commander('k2', 'Tymna', [[9, 'Adam']])] }),
      makePlayer({ playerId: 't', name: 'Tobias', commandList: [commander('ct', 'Edgar Markov', [[16, 'Adam']])] }),
    ],
  })
}

describe('CommanderSeatMatrix', () => {
  afterEach(() => {
    cleanup()
    resetCommanderMemory()
  })

  it('has one column per seat that owns a commander and one row per player', () => {
    const { getByTestId, container } = render(<CommanderSeatMatrix game={pod()} />)
    expect(container.querySelectorAll('.sm-head')).toHaveLength(3)
    expect(getByTestId('cdm-seat-row-a')).toBeTruthy()
    expect(getByTestId('cdm-seat-cell-a-a').textContent).toBe('—')
  })

  it('shows a dual-commander seat as X/Y and tones by the larger value', () => {
    const { getByTestId } = render(<CommanderSeatMatrix game={pod()} />)
    const dual = getByTestId('cdm-seat-cell-a-k')
    expect(dual.textContent).toBe('5/9')
    expect(dual.getAttribute('data-damage')).toBe('5/9')
    expect(dual.className).toContain('tone-normal')
    expect(getByTestId('cdm-seat-cell-a-t').textContent).toBe('16')
    expect(getByTestId('cdm-seat-cell-a-t').className).toContain('tone-warning')
  })

  it('names the closest commander threat', () => {
    const { getByTestId } = render(<CommanderSeatMatrix game={pod()} />)
    const text = getByTestId('cdm-threat').textContent ?? ''
    expect(text).toContain('Tobias')
    expect(text).toContain('5')
    expect(text).toContain('Adam')
  })
})
