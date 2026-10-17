import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import MechanicsOverview from './MechanicsOverview'
import { setState } from '../state/state'
import { makeCard, makeGameView, makePlayer } from '../__fixtures__/gameViews'
import { activeMechanicsCount, dungeonStateOf, speedOf } from './mechanicsState'

const bearer = makeCard({ id: 'k', name: 'Korvold', cardIcons: [{ cardIconType: 'RINGBEARER', text: '' }] as never })
const adam = makePlayer({
  playerId: 'a',
  name: 'Adam',
  controlled: true,
  battlefield: { k: bearer },
  commandList: [makeCard({ id: 'ring', name: 'The Ring', mageObjectType: 'EMBLEM', rules: ['a', 'b', 'c'] })],
})
const mira = makePlayer({
  playerId: 'm',
  name: 'Mira',
  monarch: true,
  counters: [{ name: 'speed', count: 2 }],
  commandList: [makeCard({ id: 'dun', name: 'Lost Mine of Phandelver', mageObjectType: 'DUNGEON', cardTypes: ['DUNGEON'] })],
})

describe('MechanicsOverview', () => {
  afterEach(() => {
    cleanup()
    setState({ game: null, gameId: null, dungeonProgress: {} })
  })

  it('lists the Ring levels, the dungeon map and the table state in one scroll', () => {
    setState({
      game: makeGameView({ players: [adam, mira] }),
      gameId: 'g1',
      dungeonProgress: { 'g1‖mira‖phandelver': ['Cave Entrance', 'Goblin Lair'] },
    })
    const { getByTestId, getAllByTestId } = render(<MechanicsOverview />)
    const ring = getByTestId('mech-ring')
    expect(ring.textContent).toContain('Korvold')
    const levels = getAllByTestId('mech-ring-level')
    expect(levels.map((l) => l.className.includes('done'))).toEqual([true, true, true, false])
    expect(levels[2].className).toContain('cur')
    const rooms = getAllByTestId('mech-room')
    expect(rooms.find((r) => r.dataset.state === 'cur')?.textContent).toBe('Goblin Lair')
    expect(rooms.find((r) => r.dataset.state === 'seen')?.textContent).toBe('Cave Entrance')
    const table = getByTestId('mech-table-state')
    expect(table.textContent).toContain('Mira')
    expect(table.textContent).toContain('Mira · 2 / 4')
  })

  it('falls back to the empty mechanics tray when nothing is active', () => {
    setState({ game: makeGameView({ players: [makePlayer({ playerId: 'a', name: 'Adam', controlled: true })] }) })
    const { container } = render(<MechanicsOverview />)
    expect(container.querySelector('[data-testid="mechanics-overview"]')).toBeNull()
    expect(container.querySelector('.mechanics-tray.empty')).not.toBeNull()
  })
})

describe('mechanicsState', () => {
  it('reads the current dungeon room and its depth', () => {
    const state = dungeonStateOf(mira, 'g1', { 'g1‖mira‖phandelver': ['Cave Entrance', 'Goblin Lair'] })
    expect(state).toMatchObject({ current: 'Goblin Lair', depth: 2, depthCount: 4 })
  })

  it('reads speed from a counter or a numbered designation', () => {
    expect(speedOf(mira)).toBe(2)
    expect(speedOf(makePlayer({ playerId: 'x', name: 'X', designationNames: ['Speed 4'] }))).toBe(4)
    expect(speedOf(adam)).toBeNull()
  })

  it('counts one per active mechanic for the top bar badge', () => {
    expect(activeMechanicsCount(makeGameView({ players: [adam, mira] }))).toBe(4)
    expect(activeMechanicsCount(null)).toBe(0)
  })
})
