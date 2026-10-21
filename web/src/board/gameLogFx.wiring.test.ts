import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sniffGameLogFx } from './gameLogFx'
import { clearFeedbackFx, getFeedbackFxState } from './feedbackFx'
import { clearFizzled, consumeFizzled } from './fizzleFx'
import { clearConceded, consumeConceded } from './concedeFx'
import { clearLibraryPeeks, getLibraryPeeks } from './libraryPeekFx'
import { soundManager } from '../audio/soundManager'
import { getState, setState } from '../state/state'
import { makeCard, makeGameView, makePlayer } from '../__fixtures__/gameViews'

const P = (name: string) => `<font color='#20B2AA'>${name}</font>`
const OBJ = "<font color='#B0C4DE' object_id='11111111-2222-3333-4444-555555555555'>Elvish Mystic</font> [111]"

const alice = makePlayer({ playerId: 'p1', name: 'Alice', controlled: true })
const bob = makePlayer({ playerId: 'p2', name: 'Bob' })

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => {} } as DOMRect
}

function waitUntil(assertion: () => void) {
  return vi.waitFor(assertion, { timeout: 2000, interval: 20 })
}

function floaterTexts(): string[] {
  return getFeedbackFxState().floaters.map((f) => f.text)
}

describe('game log wiring', () => {
  let prevSettings = getState().settings
  let prevGameId = getState().gameId
  let prevGame = getState().game

  beforeEach(() => {
    prevSettings = getState().settings
    prevGameId = getState().gameId
    prevGame = getState().game
    setState({
      gameId: 'g1',
      game: makeGameView({
        players: [alice, bob],
        stack: { 'bolt-1': makeCard({ id: 'bolt-1', name: 'Lightning Bolt', parentId: 'bolt-1' }) },
      }),
      settings: { ...prevSettings, effects: true },
    })
    document.body.innerHTML =
      '<div class="player-info-bar" data-player-id="p1"><span class="badge-dungeon"></span></div>'
      + '<div class="player-info-bar" data-player-id="p2"></div>'
      + '<div data-player-id="p1"><div class="library-chip"></div></div>'
      + '<div class="card-slot" data-card-id="11111111-2222-3333-4444-555555555555"></div>'
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => rect(200, 300, 100, 140))
    vi.spyOn(soundManager, 'play').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    setState({ settings: prevSettings, gameId: prevGameId, game: prevGame })
    document.body.innerHTML = ''
    clearFeedbackFx()
    clearFizzled()
    clearConceded()
    clearLibraryPeeks()
  })

  it('pay: marks the paying player bar as paid', async () => {
    sniffGameLogFx(`${P('Alice')} chooses to pay {2} to prevent the counter effect`, 'g1')
    await waitUntil(() => {
      expect(document.querySelector('.player-info-bar[data-player-id="p1"]')?.classList.contains('fx-paid')).toBe(true)
    })
  })

  it('decline: marks the declining player bar as declined, not paid', async () => {
    sniffGameLogFx(`${P('Bob')} chooses not to pay {3} to prevent the counter effect`, 'g1')
    await waitUntil(() => {
      expect(document.querySelector('.player-info-bar[data-player-id="p2"]')?.classList.contains('fx-declined')).toBe(true)
    })
    expect(document.querySelector('.player-info-bar[data-player-id="p2"]')?.classList.contains('fx-paid')).toBe(false)
  })

  it('dungeon: bursts the dungeon badge and floats the dungeon name', async () => {
    sniffGameLogFx(`${P('Alice')} has completed Lost Mine of Phandelver`, 'g1')
    await waitUntil(() => {
      expect(document.querySelector('.badge-dungeon')?.classList.contains('fx-dungeon-complete')).toBe(true)
    })
    await waitUntil(() => {
      expect(floaterTexts()).toContain('Lost Mine of Phandelver')
    })
  })

  it('choice on a card: floats the chosen value over the source card', async () => {
    sniffGameLogFx(`${OBJ}: ${P('Alice')} has chosen Blue`, 'g1')
    await waitUntil(() => {
      expect(floaterTexts()).toContain('Blue')
    })
  })

  it('choice without a source id: floats the chosen value over the player bar', async () => {
    sniffGameLogFx(`Adaptive Automaton: ${P('Bob')} has chosen Elf`, 'g1')
    await waitUntil(() => {
      expect(floaterTexts()).toContain('Elf')
    })
  })

  it('behold: lifts the beheld card', async () => {
    sniffGameLogFx(`${P('Alice')} chooses to behold ${OBJ}`, 'g1')
    await waitUntil(() => {
      expect(document.querySelector('.card-slot')?.classList.contains('fx-behold')).toBe(true)
    })
  })

  it('scry: queues a library peek of the scrying player', () => {
    sniffGameLogFx(`${P('Alice')} scries 2 (source: Opt)`, 'g1')
    const peeks = getLibraryPeeks()
    expect(peeks).toHaveLength(1)
    expect(peeks[0]).toMatchObject({ playerId: 'p1', count: 2 })
  })

  it('fizzle: marks the fizzled spell on the stack', () => {
    sniffGameLogFx('Lightning Bolt has been fizzled.', 'g1')
    expect(consumeFizzled('bolt-1')).toBe(true)
  })

  it('concede: remembers the conceding player', () => {
    sniffGameLogFx(`${P('Bob')} has conceded.`, 'g1')
    expect(consumeConceded('p2')).toBe(true)
  })

  it('other game: a line for another game leaves the view untouched', async () => {
    sniffGameLogFx(`${P('Alice')} chooses to pay {2} to prevent the counter effect`, 'other')
    await new Promise((resolve) => setTimeout(resolve, 60))
    expect(document.querySelector('.player-info-bar[data-player-id="p1"]')?.classList.contains('fx-paid')).toBe(false)
    expect(consumeConceded('p2')).toBe(false)
    expect(getFeedbackFxState().floaters).toHaveLength(0)
  })
})
