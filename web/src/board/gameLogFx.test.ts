import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSacrificed, consumeSacrificed, parseFlicker, parseLibraryPeek, parseMulligan, parseSacrifice, sniffGameLogFx } from './gameLogFx'
import { clearDiceRollFx, parseDiceRoll } from './diceRollFx'
import { getState, setState } from '../state/state'
import { makeGameView, makePermanent, makePlayer } from '../__fixtures__/gameViews'

const UUID = '1cd21e79-c96a-46bd-9041-d647332cb00b'
const name = (n: string) => `<font color='#20B2AA'>${n}</font>`
const object = (n: string) => `<font color='#B0C4DE' object_id='${UUID}'>${n}</font> [1cd]`

describe('parseFlicker', () => {
  it('reads the returned permanent out of the server line', () => {
    expect(parseFlicker(`${name('Alice')} puts ${object('Runeclaw Bear')} from exile onto the Battlefield (source: ${name('Ephemerate')})`)).toEqual({ objectId: UUID })
  })

  it('ignores returns from other zones and other moves', () => {
    expect(parseFlicker(`${name('Alice')} puts ${object('Runeclaw Bear')} from graveyard onto the Battlefield`)).toBeNull()
    expect(parseFlicker(`${name('Alice')} moves ${object('Runeclaw Bear')} from battlefield to the exile zone`)).toBeNull()
  })
})

describe('parseSacrifice', () => {
  it('reads the sacrificed permanent, not the player', () => {
    expect(parseSacrifice(`${name('Alice')} sacrificed ${object('Runeclaw Bear')} (source: ${name('Village Rites')})`)).toEqual({ objectId: UUID })
    expect(parseSacrifice(`${name('Alice')} draws a card`)).toBeNull()
  })
})

describe('parseMulligan', () => {
  it('reads the player taking a mulligan', () => {
    expect(parseMulligan(`${name('Bob')} decides to take mulligan`)).toEqual({ player: 'Bob' })
    expect(parseMulligan(`${name('Bob')} keeps hand`)).toBeNull()
  })
})

describe('parseLibraryPeek', () => {
  it('reads a scry', () => {
    expect(parseLibraryPeek(`${name('Alice')} scries 2 (source: <font color='#6495ED'>Opt</font>)`)).toEqual({ player: 'Alice', kind: 'scry', amount: 2 })
  })

  it('reads a surveil with a multi-word player name', () => {
    expect(parseLibraryPeek(`${name('Bob Smith')} surveils 1 (source: <font color='#6495ED'>Thoughtbound Phantasm</font>)`)).toEqual({ player: 'Bob Smith', kind: 'surveil', amount: 1 })
  })

  it('ignores a zero amount and every other line', () => {
    expect(parseLibraryPeek('Alice scries 0 (source: Opt)')).toBeNull()
    expect(parseLibraryPeek('Alice draws a card')).toBeNull()
    expect(parseLibraryPeek('Alice casts Opt')).toBeNull()
  })
})

describe('parseDiceRoll', () => {
  it('reads one numerical die', () => {
    expect(parseDiceRoll(`[Roll a die] ${name('Alice')} rolled a d20, result: 17 (source: ${name('Delina')})`)).toEqual({ player: 'Alice', sides: 20, results: ['17'] })
  })

  it('reads several dice and drops the ignored ones', () => {
    expect(parseDiceRoll(`[Roll a die] ${name('Bob')} rolled 4d6, results: [4, 6], ignoring [1, 3] (source: x)`)).toEqual({ player: 'Bob', sides: 6, results: ['4', '6'] })
  })

  it('reads the planar die', () => {
    expect(parseDiceRoll(`[Roll a planar die] ${name('Bob')} rolled Chaos Roll (source: ${name('Chaos Moon')})`)).toEqual({ player: 'Bob', sides: null, results: ['Chaos Roll'] })
    expect(parseDiceRoll(`[Roll a planar die] ${name('Bob')} rolled Blank Roll`)).toEqual({ player: 'Bob', sides: null, results: ['Blank Roll'] })
  })

  it('ignores every other line', () => {
    expect(parseDiceRoll('Alice rolled the dice')).toBeNull()
  })
})

describe('sacrifice note', () => {
  let prev = getState()

  beforeEach(() => {
    vi.useFakeTimers()
    prev = getState()
    clearSacrificed()
    const alice = makePlayer({ playerId: 'p-alice', name: 'Alice', controlled: true, battlefield: { [UUID]: makePermanent({ name: 'Runeclaw Bear' }) } })
    setState({ gameId: 'g1', game: makeGameView({ players: [alice] }) })
  })

  afterEach(() => {
    setState({ gameId: prev.gameId, game: prev.game })
    clearDiceRollFx()
    vi.useRealTimers()
  })

  it('is consumed once by the transition engine, within its time window', () => {
    sniffGameLogFx(`${name('Alice')} sacrificed ${object('Runeclaw Bear')}`, 'g1')
    expect(consumeSacrificed(UUID)).toBe(true)
    expect(consumeSacrificed(UUID)).toBe(false)
    sniffGameLogFx(`${name('Alice')} sacrificed ${object('Runeclaw Bear')}`, 'g1')
    vi.advanceTimersByTime(6000)
    expect(consumeSacrificed(UUID)).toBe(false)
  })

  it('ignores a line from another game', () => {
    sniffGameLogFx(`${name('Alice')} sacrificed ${object('Runeclaw Bear')}`, 'other')
    expect(consumeSacrificed(UUID)).toBe(false)
  })
})
