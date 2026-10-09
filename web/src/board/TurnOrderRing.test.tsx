import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import TurnOrderRing, { turnOrderSeats } from './TurnOrderRing'
import { makePlayer } from '../__fixtures__/gameViews'
import type { PlayerView } from '../net/types'

const me = makePlayer({ playerId: 'me', name: 'Adamysz', controlled: true })
const rival = makePlayer({ playerId: 'rival', name: 'Rivalmuygrande' })
const third = makePlayer({ playerId: 'third', name: 'Carlos' })

function withFlags(p: PlayerView, flags: Partial<PlayerView>): PlayerView {
  return { ...p, ...flags }
}

describe('TurnOrderRing', () => {
  afterEach(() => cleanup())

  it('the walkway puts my seat last, whoever the server lists first', () => {
    const a = turnOrderSeats([me, rival, third], true).map((p) => p.playerId)
    const b = turnOrderSeats([third, me, rival], true).map((p) => p.playerId)
    expect(a).toEqual(['rival', 'third', 'me'])
    expect(b[b.length - 1]).toBe('me')
    expect(b.length).toBe(3)
  })

  it('the pod ring keeps the turn order (the reverse of the server list)', () => {
    expect(turnOrderSeats([me, rival, third]).map((p) => p.playerId)).toEqual(['third', 'rival', 'me'])
  })

  it('the walkway drops the life counter and the trailing arrow', () => {
    const { container, getByTestId } = render(<TurnOrderRing lane players={[me, rival]} activePlayerId="rival" />)
    const lane = getByTestId('turn-lane')
    expect(lane.classList.contains('lane')).toBe(true)
    expect(lane.querySelectorAll('.tor-seat').length).toBe(2)
    expect(lane.querySelectorAll('.tor-seat-life').length).toBe(0)
    expect(lane.querySelectorAll('.tor-arrow').length).toBe(1)
    expect(container.querySelectorAll('.turn-order-ring').length).toBe(1)
  })

  it('turn and priority are separate markers and can be on the same seat', () => {
    const players = [
      withFlags(rival, { hasPriority: true }),
      withFlags(me, { hasPriority: true }),
    ]
    const { getByTestId } = render(<TurnOrderRing lane players={players} activePlayerId="rival" />)
    const rivalSeat = getByTestId('tor-seat-rival')
    const mySeat = getByTestId('tor-seat-me')
    expect(rivalSeat.classList.contains('is-active')).toBe(true)
    expect(rivalSeat.classList.contains('has-priority')).toBe(true)
    expect(rivalSeat.dataset.active).toBe('true')
    expect(rivalSeat.dataset.priority).toBe('true')
    expect(mySeat.classList.contains('is-active')).toBe(false)
    expect(mySeat.dataset.priority).toBe('true')
  })

  it('my own active seat is named differently from somebody else being active', () => {
    const rivalActive = render(<TurnOrderRing lane players={[me, withFlags(rival, { hasPriority: true })]} activePlayerId="rival" />)
    const rivalBadge = rivalActive.getByTestId('tor-active-badge').textContent
    rivalActive.unmount()
    const mineActive = render(<TurnOrderRing lane players={[withFlags(me, { hasPriority: true }), rival]} activePlayerId="me" />)
    const myBadge = mineActive.getByTestId('tor-active-badge').textContent
    expect(myBadge).toBeTruthy()
    expect(myBadge).not.toBe(rivalBadge)
  })
})
