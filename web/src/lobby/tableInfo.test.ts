import { describe, expect, it } from 'vitest'
import { parseTableInfo, tableInfoTooltip } from './tableInfo'

describe('parseTableInfo', () => {
  it('LBY-23: reads the match options the server packs before the first game', () => {
    const info = parseTableInfo('Wins: 2, Time: 20m(+10s), Custom options (2), RB, SP, Rng: ONE')
    expect(info).toMatchObject({
      winsNeeded: 2,
      score: null,
      timeLimit: '20m',
      bufferTime: '10s',
      customOptions: 2,
      rollbacks: true,
      spectators: true,
      range: 'ONE',
      other: [],
    })
  })

  it('LBY-23: reads the score and the draws of a match in progress', () => {
    const info = parseTableInfo('Wins: 2 Score: 1-0-1 Draws: 1, SP')
    expect(info.winsNeeded).toBe(2)
    expect(info.score).toEqual([1, 0, 1])
    expect(info.draws).toBe(1)
    expect(info.spectators).toBe(true)
    expect(info.noTimeLimit).toBe(false)
  })

  it('LBY-23: reads the tournament options and treats no time limit as none', () => {
    const info = parseTableInfo('Wins: 1, Time: None, Constr.: 15m, Pick time: x1.5, 1 GAME, SP')
    expect(info).toMatchObject({ winsNeeded: 1, timeLimit: null, noTimeLimit: true, bufferTime: null, constructionTime: '15m', pickTime: 'x1.5', singleGame: true })
  })

  it('LBY-23: keeps the tokens it does not know instead of dropping them', () => {
    expect(parseTableInfo('Wins: 1, Planechase forever').other).toEqual(['Planechase forever'])
    expect(parseTableInfo('').other).toEqual([])
    expect(parseTableInfo(undefined).winsNeeded).toBeNull()
  })

  it('turns the desktop tooltip markup into plain lines', () => {
    expect(tableInfoTooltip('Wins required: 2 (Best of 3)<br>Emblem cards:<br>* <b>Sol Ring</b> (global)'))
      .toBe('Wins required: 2 (Best of 3)\nEmblem cards:\n* Sol Ring (global)')
  })
})
