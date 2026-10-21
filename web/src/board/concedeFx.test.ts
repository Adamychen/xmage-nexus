import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearConceded, consumeConceded, noteConceded, parseConcede, sniffConcede } from './concedeFx'
import { getState, setState } from '../state/state'
import { makeGameView, makePlayer } from '../__fixtures__/gameViews'

const name = (n: string) => `<font color='#20B2AA'>${n}</font>`

describe('parseConcede', () => {
  it('reads the player who conceded', () => {
    expect(parseConcede(`${name('Alice')} has conceded.`)).toEqual({ player: 'Alice' })
    expect(parseConcede('Bob Smith has conceded')).toEqual({ player: 'Bob Smith' })
    expect(parseConcede('Alice has lost the game.')).toBeNull()
  })
})

describe('conceded note', () => {
  afterEach(() => {
    clearConceded()
  })

  it('is consumed once per player', () => {
    noteConceded('p1')
    expect(consumeConceded('p1')).toBe(true)
    expect(consumeConceded('p1')).toBe(false)
    expect(consumeConceded('p2')).toBe(false)
  })
})

describe('sniffConcede', () => {
  let prev = getState()

  beforeEach(() => {
    prev = getState()
    clearConceded()
    const alice = makePlayer({ playerId: 'p1', name: 'Alice' })
    setState({ gameId: 'g1', game: makeGameView({ players: [alice] }) })
  })

  afterEach(() => {
    setState({ gameId: prev.gameId, game: prev.game })
    clearConceded()
  })

  it('notes the conceding player of the current game', () => {
    sniffConcede(`${name('Alice')} has conceded.`, 'g1')
    expect(consumeConceded('p1')).toBe(true)
  })

  it('ignores a line from another game', () => {
    sniffConcede(`${name('Alice')} has conceded.`, 'other')
    expect(consumeConceded('p1')).toBe(false)
  })
})
