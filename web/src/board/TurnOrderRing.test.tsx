import { cleanup, fireEvent, render } from '@testing-library/react'
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

  it('BRD-7: the own pill is clickable only in the main board mode', () => {
    const picked: string[] = []
    const { getByTestId, rerender } = render(
      <TurnOrderRing players={[me, rival, third]} activePlayerId="me" onSeatClick={(id) => picked.push(id)} />,
    )
    fireEvent.click(getByTestId('tor-seat-me'))
    expect(picked).toEqual([])
    expect(getByTestId('tor-seat-me').getAttribute('role')).toBeNull()
    rerender(
      <TurnOrderRing players={[me, rival, third]} activePlayerId="me" onSeatClick={(id) => picked.push(id)} selfClickable />,
    )
    fireEvent.click(getByTestId('tor-seat-me'))
    expect(picked).toEqual(['me'])
    expect(getByTestId('tor-seat-me').getAttribute('role')).toBe('button')
  })

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
    const walkway = getByTestId('turn-lane')
    const row = walkway.querySelector<HTMLElement>('.tor-seats-flow')
    expect(walkway.classList.contains('lane')).toBe(true)
    // The measured clones under .tor-measure-layer repeat the seats on purpose
    // (they are how the walkway learns its natural width): count the real row.
    expect(row?.querySelectorAll('.tor-seat').length).toBe(2)
    expect(row?.querySelectorAll('.tor-seat-life').length).toBe(0)
    expect(row?.querySelectorAll('.tor-arrow').length).toBe(1)
    expect(container.querySelectorAll('.turn-order-ring').length).toBe(1)
  })

  it('the measurement clones carry no test id and never take part in the layout', () => {
    const { container, getByTestId, getAllByTestId } = render(<TurnOrderRing lane players={[me, rival, third]} activePlayerId="rival" />)
    const walkway = getByTestId('turn-lane')
    const layer = walkway.querySelector<HTMLElement>('[data-measure]')
    expect(layer).not.toBeNull()
    expect(layer?.getAttribute('aria-hidden')).toBe('true')
    expect(layer?.querySelectorAll('[data-testid]')).toHaveLength(0)
    // one badge for the real active seat, nothing from the clones
    expect(getAllByTestId('tor-active-badge')).toHaveLength(1)
    // The full-width clone mirrors the row (seats *and* the arrows between
    // them): measure less than the row needs and the walkway clips anyway.
    const rulers = Array.from(container.querySelectorAll<HTMLElement>('[data-lane-measure]'))
    expect(rulers.map((r) => r.dataset.laneMeasure)).toEqual(['full', 'solo', 'solo-dots'])
    expect(rulers[0].querySelectorAll('.tor-seat').length).toBe(3)
    expect(rulers[0].querySelectorAll('.tor-arrow').length).toBe(2)
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

  it('has no ruler outside the walkway: the ring and the FFA switcher are position-coded', () => {
    const { container } = render(<TurnOrderRing players={[rival, me]} activePlayerId="rival" />)
    expect(container.querySelector('[data-lane-measure]')).toBeNull()
    expect(container.querySelector<HTMLElement>('.turn-order-ring')?.dataset.laneFit).toBeUndefined()
  })

  it('BRD-3: a live opponent pill is a button that reports its seat, my own pill is not', () => {
    const picked: string[] = []
    const dead = withFlags(third, { hasLeft: true, life: 0 })
    const { getByTestId } = render(
      <TurnOrderRing players={[me, rival, dead]} activePlayerId="me" onSeatClick={(id) => picked.push(id)} />,
    )
    fireEvent.click(getByTestId('tor-seat-rival'))
    expect(picked).toEqual(['rival'])
    expect(getByTestId('tor-seat-rival').getAttribute('role')).toBe('button')
    expect(getByTestId('tor-seat-me').getAttribute('role')).toBeNull()
    expect(getByTestId('tor-seat-third').getAttribute('role')).toBeNull()
    fireEvent.keyDown(getByTestId('tor-seat-rival'), { key: 'Enter' })
    expect(picked).toEqual(['rival', 'rival'])
  })

  it('BRD-3: without onSeatClick the pills are plain labels', () => {
    const { getByTestId } = render(<TurnOrderRing players={[me, rival]} activePlayerId="me" />)
    expect(getByTestId('tor-seat-rival').getAttribute('role')).toBeNull()
  })

  it('BRD-3: the focused opponent pill reports aria-pressed', () => {
    const { getByTestId } = render(
      <TurnOrderRing players={[me, rival, third]} activePlayerId="me" onSeatClick={() => {}} focusedId="rival" />,
    )
    expect(getByTestId('tor-seat-rival').getAttribute('aria-pressed')).toBe('true')
    expect(getByTestId('tor-seat-third').getAttribute('aria-pressed')).toBe('false')
  })
})
