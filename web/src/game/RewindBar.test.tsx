// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { GameView } from '../net/types'
import { setLanguage } from '../i18n'
import RewindBar from './RewindBar'
import { captureRewind, clearRewind, getRewind, useRewind, viewedSnapshot } from './rewind'

function Harness() {
  return <RewindBar rewind={useRewind()} />
}

function view(turn: number, step: string): GameView {
  return { turn, step } as unknown as GameView
}

beforeEach(() => {
  setLanguage('en')
  clearRewind()
})

afterEach(() => {
  cleanup()
  clearRewind()
})

describe('RewindBar', () => {
  it('stays out of the way until there is a past to look at', () => {
    captureRewind('g1', view(1, 'UPKEEP'))
    render(<Harness />)
    expect(screen.queryByTestId('rewind-open')).toBeNull()
    expect(screen.queryByTestId('rewind-bar')).toBeNull()
  })

  it('scrubs to an earlier step, says it is not live and returns to live', () => {
    captureRewind('g1', view(1, 'UPKEEP'))
    captureRewind('g1', view(1, 'DRAW'))
    captureRewind('g1', view(2, 'UPKEEP'))
    render(<Harness />)

    fireEvent.click(screen.getByTestId('rewind-open'))
    expect(screen.getByTestId('rewind-status').textContent).toContain('Live board')

    fireEvent.change(screen.getByTestId('rewind-slider'), { target: { value: '0' } })
    expect(viewedSnapshot(getRewind())?.turn).toBe(1)
    expect(screen.getByTestId('rewind-status').textContent).toContain('Not live')
    expect(screen.getByTestId('rewind-status').textContent).toContain('Turn 1')

    fireEvent.click(screen.getByTestId('rewind-live'))
    expect(getRewind().viewing).toBeNull()
  })

  it('KEY-12: steps with the arrow keys and leaves with Escape while viewing', () => {
    captureRewind('g1', view(1, 'UPKEEP'))
    captureRewind('g1', view(1, 'DRAW'))
    captureRewind('g1', view(1, 'PRECOMBAT_MAIN'))
    render(<Harness />)
    fireEvent.click(screen.getByTestId('rewind-open'))
    fireEvent.change(screen.getByTestId('rewind-slider'), { target: { value: '1' } })

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    })
    expect(viewedSnapshot(getRewind())?.step).toBe('UPKEEP')
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    })
    expect(viewedSnapshot(getRewind())?.step).toBe('DRAW')
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(getRewind().viewing).toBeNull()
  })

  it('in a replay it is always open, says so, and closes the replay instead of returning to live', async () => {
    const { buildReplayFile, openReplay } = await import('./rewind')
    captureRewind('g1', view(1, 'UPKEEP'))
    captureRewind('g1', view(2, 'UPKEEP'))
    const file = buildReplayFile()!
    clearRewind()
    openReplay(file)
    render(<Harness />)

    expect(screen.getByTestId('rewind-bar')).toBeTruthy()
    expect(screen.queryByTestId('rewind-open')).toBeNull()
    expect(screen.queryByTestId('rewind-live')).toBeNull()
    expect(screen.queryByTestId('rewind-save')).toBeNull()
    expect(screen.getByTestId('rewind-status').textContent).toContain('Replay')

    fireEvent.change(screen.getByTestId('rewind-slider'), { target: { value: '1' } })
    expect(viewedSnapshot(getRewind())?.turn).toBe(2)
    expect(getRewind().replay).toBe(true)
  })
})
