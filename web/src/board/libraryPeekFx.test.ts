import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearLibraryPeeks, getLibraryPeeks, PEEK_MAX_CARDS, spawnLibraryPeek } from './libraryPeekFx'
import { soundManager } from '../audio/soundManager'
import { getState, setState } from '../state/state'

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => {} } as DOMRect
}

describe('library peek effect', () => {
  let prevSettings = getState().settings

  beforeEach(() => {
    vi.useFakeTimers()
    clearLibraryPeeks()
    prevSettings = getState().settings
    setState({ settings: { ...prevSettings, effects: true } })
    document.body.innerHTML = '<div data-player-id="p1"><button class="resource-chip library-chip"></button></div>'
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('library-chip')) return rect(810, 88, 48, 25)
      return rect(0, 0, 0, 0)
    })
    vi.spyOn(soundManager, 'play').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    setState({ settings: prevSettings, gameId: null, game: null })
    document.body.innerHTML = ''
    clearLibraryPeeks()
  })

  it('does nothing when the player has no visible library', () => {
    document.body.innerHTML = ''
    expect(spawnLibraryPeek('p1', 2)).toBeNull()
    expect(getLibraryPeeks()).toHaveLength(0)
  })

  it('lifts the top cards of a visible library and clears them after the run', () => {
    const fx = spawnLibraryPeek('p1', 2)
    expect(fx).toMatchObject({ playerId: 'p1', count: 2 })
    expect(getLibraryPeeks()).toHaveLength(1)
    expect(soundManager.play).toHaveBeenCalledWith('draw', 'game')

    vi.advanceTimersByTime((fx?.duration ?? 0) + 50)
    expect(getLibraryPeeks()).toHaveLength(0)
  })

  it('caps the lifted cards at PEEK_MAX_CARDS', () => {
    expect(spawnLibraryPeek('p1', 9)).toMatchObject({ count: PEEK_MAX_CARDS })
  })

  it('does nothing for a zero scry or surveil', () => {
    expect(spawnLibraryPeek('p1', 0)).toBeNull()
    expect(getLibraryPeeks()).toHaveLength(0)
  })
})
