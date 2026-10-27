import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import MechanicsOverview from './MechanicsOverview'
import { setState } from '../state/state'
import { makeCard, makeGameView, makePlayer } from '../__fixtures__/gameViews'
import { activeMechanicsCount, dungeonStateOf, speedOf } from './mechanicsState'
import { findDungeonGraph } from './dungeons'

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
const tobias = makePlayer({ playerId: 't', name: 'Tobias', initiative: true, designationNames: ["City's Blessing"] })
const progress = { 'g1‖mira‖phandelver': ['Cave Entrance', 'Goblin Lair'] }

describe('MechanicsOverview', () => {
  afterEach(() => {
    cleanup()
    setState({ game: null, gameId: null, dungeonProgress: {} })
  })

  it('PNL-8: the Ring is a card whose owner chip carries the owner name in the seat colour', () => {
    setState({ game: makeGameView({ players: [adam, mira] }), gameId: 'g1', dungeonProgress: progress })
    const { getByTestId } = render(<MechanicsOverview />)
    const chip = getByTestId('mech-ring').querySelector('.mech-owner') as HTMLElement
    expect(chip.textContent).toBe('Adam')
    expect(chip.style.color).toBe('var(--seat-0)')
  })

  it('PNL-8: without a ring-bearer the bearer line shows the no-bearer text once and no label', () => {
    const noBearer = makePlayer({
      playerId: 'a',
      name: 'Adam',
      controlled: true,
      commandList: [makeCard({ id: 'ring', name: 'The Ring', mageObjectType: 'EMBLEM', rules: ['a'] })],
    })
    setState({ game: makeGameView({ players: [noBearer] }), gameId: 'g1', dungeonProgress: {} })
    const { getByTestId, queryByText } = render(<MechanicsOverview />)
    const line = getByTestId('mech-ring').querySelector('.mech-bearer') as HTMLElement
    expect(line.textContent).toBe('Sin portador del Anillo')
    expect(line.querySelector('em')?.textContent).toBe('Sin portador del Anillo')
    expect(line.querySelector('span')).toBeNull()
    expect(queryByText('Portador del Anillo')).toBeNull()
  })

  it('PNL-8: the ring bar fills one step per level of four and the current ability is highlighted', () => {
    setState({ game: makeGameView({ players: [adam, mira] }), gameId: 'g1', dungeonProgress: progress })
    const { getByTestId, getAllByTestId, container } = render(<MechanicsOverview />)
    const ring = getByTestId('mech-ring')
    const bar = ring.querySelector('[role="img"]') as HTMLElement
    expect(bar.getAttribute('aria-label')).toContain('3')
    expect(bar.querySelectorAll('.mech-step')).toHaveLength(4)
    expect(bar.querySelectorAll('.mech-step.on')).toHaveLength(3)
    expect(ring.textContent).toContain('Korvold')
    const levels = getAllByTestId('mech-ring-level')
    expect(levels.map((l) => l.className.includes('done'))).toEqual([true, true, true, false])
    expect(levels[2].className).toContain('cur')
    expect(levels[3].className).toContain('locked')
    expect(container.querySelectorAll('.mech-lvl.cur')).toHaveLength(1)
  })

  it('PNL-8: dungeon rooms are one row per depth with the current room marked and the visited rooms tinted', () => {
    setState({ game: makeGameView({ players: [adam, mira] }), gameId: 'g1', dungeonProgress: progress })
    const { getByTestId, getAllByTestId } = render(<MechanicsOverview />)
    const dungeon = getByTestId('mech-dungeon')
    const graph = findDungeonGraph('Lost Mine of Phandelver')
    expect(graph).not.toBeNull()
    const rows = dungeon.querySelectorAll('.mech-depth')
    expect(rows).toHaveLength(graph!.depths.length)
    expect(rows[1].querySelector('[data-state="cur"]')?.textContent).toBe('Goblin Lair')
    expect(rows[1].querySelector('.mech-room')?.getAttribute('data-state')).toBe('cur')
    expect(rows[0].querySelector('[data-state="seen"]')?.textContent).toBe('Cave Entrance')
    expect(getAllByTestId('mech-room').filter((r) => r.dataset.state === 'cur')).toHaveLength(1)
    expect(dungeon.querySelector('.mech-owner')?.textContent).toBe('Mira')
    expect(dungeon.querySelector('.mech-hint-room')?.textContent).toBe('Goblin Lair')
  })

  it('PNL-8: table state tiles name the monarch, initiative and blessing players in their seat colour', () => {
    setState({ game: makeGameView({ players: [adam, mira, tobias] }), gameId: 'g1', dungeonProgress: progress })
    const { getByTestId } = render(<MechanicsOverview />)
    const tiles = getByTestId('mech-table-state').querySelectorAll<HTMLElement>('.mech-tile')
    expect(tiles).toHaveLength(4)
    const value = (tile: Element) => tile.querySelector<HTMLElement>('.mech-tile-value')
    expect(value(tiles[0])?.textContent).toBe('Mira')
    expect(value(tiles[0])?.style.color).toBe('var(--seat-1)')
    expect(value(tiles[1])?.textContent).toBe('Tobias')
    expect(value(tiles[1])?.style.color).toBe('var(--seat-2)')
    expect(value(tiles[2])?.textContent).toBe('Tobias')
    expect(value(tiles[2])?.style.color).toBe('var(--seat-2)')
  })

  it('PNL-8: the speed tile shows a four-step bar in the player seat colour', () => {
    setState({ game: makeGameView({ players: [adam, mira] }), gameId: 'g1', dungeonProgress: progress })
    const { getByTestId } = render(<MechanicsOverview />)
    const speed = [...getByTestId('mech-table-state').querySelectorAll<HTMLElement>('.mech-tile')].at(-1)!
    expect(speed.querySelector('.mech-tile-value')?.textContent).toBe('Mira')
    const bar = speed.querySelector('[role="img"]') as HTMLElement
    expect(bar.querySelectorAll('.mech-step')).toHaveLength(4)
    expect(bar.querySelectorAll('.mech-step.on')).toHaveLength(2)
    expect((bar.querySelector('.mech-step.on') as HTMLElement).style.background).toBe('var(--seat-1)')
  })

  it('PNL-8: day and night is a tile with no player name', () => {
    const night = makePlayer({
      playerId: 'w',
      name: 'Wolf',
      controlled: true,
      battlefield: {
        p: makeCard({
          id: 'p',
          name: 'Storm-Charged Slasher',
          rules: ["It's currently night, active player has cast 0 spells this turn."],
        }),
      },
    })
    setState({ game: makeGameView({ players: [night] }), gameId: null, dungeonProgress: {} })
    const { getByTestId } = render(<MechanicsOverview />)
    const tile = getByTestId('mech-table-state').querySelector('.mech-tile') as HTMLElement
    expect(tile.querySelector('.mech-tile-value')?.textContent).toBe('Noche')
    expect(tile.querySelector('.mech-owner')).toBeNull()
    expect(tile.querySelector('[style]')).toBeNull()
  })

  it('shows the glossary instead of the mechanics sections when nothing is in play', () => {
    setState({ game: makeGameView({ players: [makePlayer({ playerId: 'a', name: 'Adam', controlled: true })] }) })
    const { container, getByTestId } = render(<MechanicsOverview />)
    expect(container.querySelector('[data-testid="mechanics-overview"]')).toBeNull()
    expect(getByTestId('mechanics-glossary')).toBeDefined()
  })
})

describe('mechanicsState', () => {
  it('reads the current dungeon room and its depth', () => {
    const state = dungeonStateOf(mira, 'g1', progress)
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
