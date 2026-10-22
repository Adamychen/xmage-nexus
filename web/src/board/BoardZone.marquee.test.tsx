// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { PermanentView, PlayerView } from '../net/types'
import BoardZone from './BoardZone'
import { setState } from '../state/store'
import { makeGameView, makePermanent, makePlayer } from '../__fixtures__/gameViews'

function playerWith(battlefield: Record<string, PermanentView>): PlayerView {
  return makePlayer({ playerId: 'p1', name: 'Alice', controlled: true, battlefield })
}

describe('BoardZone planeswalker marquee', () => {
  afterEach(() => {
    setState({ game: null, gameId: null, playerMenu: null })
    cleanup()
  })

  it('wheel-scrolls the marquee that mounts after the first render', () => {
    const bear = makePermanent({ name: 'Grizzly Bears', id: 'bear' })
    const walker = makePermanent({ name: 'Jace', id: 'walker', cardTypes: ['Planeswalker'] })
    const first = playerWith({ bear })
    setState({ game: makeGameView({ players: [first] }) as never })
    const { container, rerender } = render(<BoardZone player={first} />)
    expect(container.querySelector('.bz-marquee')).toBeNull()

    const second = playerWith({ bear, walker })
    setState({ game: makeGameView({ players: [second] }) as never })
    rerender(<BoardZone player={second} />)
    const marquee = container.querySelector<HTMLElement>('.bz-marquee')!
    expect(marquee).not.toBeNull()
    Object.defineProperty(marquee, 'clientWidth', { value: 200, configurable: true })
    Object.defineProperty(marquee, 'scrollWidth', { value: 600, configurable: true })
    Object.defineProperty(marquee, 'scrollLeft', { value: 0, writable: true, configurable: true })

    const wheel = new WheelEvent('wheel', { deltaY: 40, deltaX: 0, cancelable: true, bubbles: true })
    marquee.dispatchEvent(wheel)
    expect(wheel.defaultPrevented).toBe(true)
    expect(marquee.scrollLeft).toBe(40)
  })
})
