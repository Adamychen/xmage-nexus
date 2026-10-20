import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearShuffles, getShuffles, parseShuffle, sniffShuffle, spawnShuffle } from './shuffleFx'
import { soundManager } from '../audio/soundManager'
import { getState, setState } from '../state/state'
import { makeGameView, makePlayer } from '../__fixtures__/gameViews'

const alice = makePlayer({ playerId: 'p-alice', name: 'Alice', controlled: true })
const bob = makePlayer({ playerId: 'p-bob', name: 'Bob' })

const SERVER_LINE = (name: string) =>
  `<font color='#20B2AA'>${name}</font>'s library is shuffled (source: <font color='#6495ED'>Evolving Wilds</font>)`

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => {} } as DOMRect
}

describe('parseShuffle', () => {
  it('reads the player out of the server log line, colour tags and source included', () => {
    expect(parseShuffle(SERVER_LINE('Alice'))).toEqual({ player: 'Alice' })
    expect(parseShuffle("Bob's library is shuffled")).toEqual({ player: 'Bob' })
  })

  it('reads cards shuffled into a library', () => {
    expect(parseShuffle("<font color='#20B2AA'>Bob</font> shuffles two cards into their library (source: Elixir)")).toEqual({ player: 'Bob' })
    expect(parseShuffle('Bob shuffles a card into their library')).toEqual({ player: 'Bob' })
  })

  it('ignores every other line', () => {
    expect(parseShuffle('Alice draws a card')).toBeNull()
    expect(parseShuffle("Alice searches Bob's library")).toBeNull()
  })
})

describe('shuffle effect', () => {
  let prevSettings = getState().settings

  beforeEach(() => {
    vi.useFakeTimers()
    clearShuffles()
    prevSettings = getState().settings
    setState({ gameId: 'g1', game: makeGameView({ players: [alice, bob] }), settings: { ...prevSettings, effects: true } })
    document.body.innerHTML =
      '<div data-player-id="p-alice"><button class="resource-stack library-stack"></button></div>'
      + '<div class="player-info-bar" data-player-id="p-bob"><button class="resource-chip library-chip"></button></div>'
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('library-stack')) return rect(1200, 640, 68, 96)
      if (this.classList.contains('library-chip')) return rect(810, 88, 48, 25)
      if (this.classList.contains('player-info-bar')) return rect(730, 58, 250, 130)
      return rect(0, 0, 0, 0)
    })
    vi.spyOn(soundManager, 'play').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    setState({ settings: prevSettings, gameId: null, game: null })
    document.body.innerHTML = ''
    clearShuffles()
  })

  it('riffles a pile in place and hides its back meanwhile', () => {
    sniffShuffle(SERVER_LINE('Alice'), 'g1')
    const [fx] = getShuffles()
    expect(fx).toMatchObject({ playerId: 'p-alice', mode: 'pile', mine: true, deckX: 1234, deckY: 688 })
    expect(document.querySelector('.library-stack')?.classList.contains('is-shuffling')).toBe(true)
    expect(soundManager.play).toHaveBeenCalledWith('shuffle', 'game')

    vi.advanceTimersByTime(fx.duration + 50)
    expect(getShuffles()).toHaveLength(0)
    expect(document.querySelector('.library-stack')?.classList.contains('is-shuffling')).toBe(false)
  })

  it('pops the deck out of a top chip below its portrait, towards the board', () => {
    sniffShuffle(SERVER_LINE('Bob'), 'g1')
    const [fx] = getShuffles()
    expect(fx).toMatchObject({ playerId: 'p-bob', mode: 'chip', mine: false, deckX: 834 })
    expect(fx.deckY).toBeGreaterThan(58 + 130)
  })

  it('ignores lines for another game, unknown players and quick repeats', () => {
    sniffShuffle(SERVER_LINE('Alice'), 'other-game')
    sniffShuffle(SERVER_LINE('Carol'), 'g1')
    expect(getShuffles()).toHaveLength(0)

    sniffShuffle(SERVER_LINE('Alice'), 'g1')
    sniffShuffle(SERVER_LINE('Alice'), 'g1')
    expect(soundManager.play).toHaveBeenCalledTimes(1)
  })

  it('does nothing with effects off or when the library is not drawn', () => {
    setState({ settings: { ...getState().settings, effects: false } })
    expect(spawnShuffle('p-alice')).toBeNull()

    setState({ settings: { ...getState().settings, effects: true } })
    document.body.innerHTML = ''
    expect(spawnShuffle('p-alice')).toBeNull()
  })
})
