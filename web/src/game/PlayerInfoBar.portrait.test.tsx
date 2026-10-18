import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PlayerInfoBar from './PlayerInfoBar'
import { ChromeActionsContext } from './chromeActions'
import { setSetting } from '../state/store'
import { setState } from '../state/state'
import { resetCommanderMemory } from '../board/commanders'
import { commanderDamageRule, commanderInfoRule, makeCard, makeGameView, makePlayer } from '../__fixtures__/gameViews'

const me = makePlayer({ playerId: 'a', name: 'Adam', controlled: true, life: 33, handCount: 7 })
const tobias = makePlayer({
  playerId: 't',
  name: 'Tobias',
  life: 27,
  handCount: 3,
  monarch: true,
  initiative: true,
  designationNames: ["City's Blessing"],
  commandList: [makeCard({ id: 'ct', name: 'Edgar Markov', mageObjectType: 'COMMANDER', rules: [commanderInfoRule(0), commanderDamageRule(16, 'Adam')] })],
})

describe('PlayerInfoBar portrait (new table interface)', () => {
  beforeEach(() => {
    setSetting('gameUi', 'v2')
    setState({ game: makeGameView({ players: [me, tobias] }) })
  })
  afterEach(() => {
    cleanup()
    resetCommanderMemory()
    setSetting('gameUi', 'v1')
    setState({ game: null })
  })

  it('moves the life to a big number and keeps the life-value and data-life hooks', () => {
    const { container } = render(<PlayerInfoBar player={me} side="my" />)
    expect(container.querySelector('.player-info-bar')?.className).toContain('is-portrait')
    expect(container.querySelector('.player-info-bar')?.getAttribute('data-life')).toBe('33')
    expect(container.querySelector('.pp-life .life-value')?.textContent).toBe('33')
    expect(container.querySelector('.life-counter')).toBeNull()
  })

  it('shows the cards in hand on the avatar, for you and for opponents', () => {
    const mine = render(<PlayerInfoBar player={me} side="my" />)
    expect(mine.getByTestId('pp-hand-count').textContent).toBe('7')
    cleanup()
    const theirs = render(<PlayerInfoBar player={tobias} side="opp" />)
    expect(theirs.getByTestId('pp-hand-count').textContent).toBe('3')
  })

  it('labels the table mechanics as chips', () => {
    const { container } = render(<PlayerInfoBar player={tobias} side="opp" />)
    const labels = [...container.querySelectorAll('.player-chips .badge-label')].map((el) => el.textContent)
    expect(labels).toContain('Monarca')
    expect(labels).toContain('Iniciativa')
    expect(labels).toContain('Bendición')
  })

  it('uses short chips for the Ring, speed and the current dungeon room', () => {
    const mira = makePlayer({
      playerId: 'm',
      name: 'Mira',
      counters: [{ name: 'speed', count: 3 }],
      commandList: [
        makeCard({ id: 'ring', name: 'The Ring', mageObjectType: 'EMBLEM', rules: ['a', 'b'] }),
        makeCard({ id: 'dun', name: 'Lost Mine of Phandelver', mageObjectType: 'DUNGEON', cardTypes: ['DUNGEON'] }),
      ],
    })
    setState({ game: makeGameView({ players: [me, mira] }) })
    const { container } = render(<PlayerInfoBar player={mira} side="opp" />)
    const labels = [...container.querySelectorAll('.player-chips .badge-label')].map((el) => el.textContent)
    expect(labels).toEqual(expect.arrayContaining(['Anillo 2', 'Velocidad 3', 'Cave Entrance 1/4']))
    expect(container.querySelector('.player-chips .counter-speed')).toBeNull()
  })

  it('shows the Ring level and the dungeon room as visible text inside their chips', () => {
    const mira = makePlayer({
      playerId: 'm',
      name: 'Mira',
      commandList: [
        makeCard({ id: 'ring', name: 'The Ring', mageObjectType: 'EMBLEM', rules: ['a', 'b'] }),
        makeCard({ id: 'dun', name: 'Lost Mine of Phandelver', mageObjectType: 'DUNGEON', cardTypes: ['DUNGEON'] }),
      ],
    })
    setState({ game: makeGameView({ players: [me, mira] }) })
    const { container } = render(<PlayerInfoBar player={mira} side="opp" />)
    const ring = container.querySelector('.player-chips .badge-ring')
    const dungeon = container.querySelector('.player-chips .badge-dungeon')
    expect(ring?.querySelector('.badge-label')?.textContent).toBe('Anillo 2')
    expect(dungeon?.querySelector('.badge-label')?.textContent).toBe('Cave Entrance 1/4')
    expect(ring?.getAttribute('title')).toContain('2')
  })

  it('adds one chip per commander that damaged the player and flags the dangerous ones', () => {
    const { getAllByTestId } = render(<PlayerInfoBar player={me} side="my" />)
    const chips = getAllByTestId('commander-chip')
    expect(chips).toHaveLength(1)
    expect(chips[0].textContent).toContain('16/21')
    expect(chips[0].className).toContain('tone-warning')
    expect(chips[0].getAttribute('title')).toContain('Edgar Markov')
  })

  it('shows only the rank icon, on the avatar corner opposite the hand count', () => {
    const ranked = makePlayer({ playerId: 'r', name: 'Rina', isHuman: true, userData: { generalRating: 1850 } as never })
    setState({ game: makeGameView({ players: [me, ranked] }) })
    const { container } = render(<PlayerInfoBar player={ranked} side="opp" />)
    const badge = container.querySelector('.player-avatar .rank-badge.pp-rank-icon')
    expect(badge).not.toBeNull()
    expect(badge?.querySelector('.rank-badge-name')).toBeNull()
    expect(container.querySelector('.player-name-row .rank-badge')).toBeNull()
    expect(container.querySelectorAll('.rank-badge')).toHaveLength(1)
  })

  it('renders the v2 rank as a large emblem with no name or elo text', () => {
    const ranked = makePlayer({ playerId: 'r', name: 'Rina', isHuman: true, userData: { generalRating: 1850 } as never })
    setState({ game: makeGameView({ players: [me, ranked] }) })
    const { container } = render(<PlayerInfoBar player={ranked} side="opp" />)
    const badge = container.querySelector('.player-avatar .rank-badge.pp-rank-icon') as HTMLElement
    expect(badge).not.toBeNull()
    expect(badge.classList.contains('pp-rank-icon-lg')).toBe(true)
    expect(badge.querySelector('.rank-emblem svg')).not.toBeNull()
    expect(badge.querySelector('.rank-badge-elo')).toBeNull()
    expect(badge.textContent?.trim()).toBe('')
  })

  it('opens the mechanics panel from a mechanic chip', () => {
    const openPanel = vi.fn()
    const { container } = render(
      <ChromeActionsContext.Provider value={{ openPanel, sidePanelOpen: false }}>
        <PlayerInfoBar player={tobias} side="opp" />
      </ChromeActionsContext.Provider>,
    )
    fireEvent.click(container.querySelector('.badge-monarch') as Element)
    expect(openPanel).toHaveBeenCalledWith('mechanics')
  })

  it('leaves the classic bar untouched while the setting is v1', () => {
    setSetting('gameUi', 'v1')
    const { container, queryByTestId } = render(<PlayerInfoBar player={tobias} side="opp" />)
    expect(container.querySelector('.is-portrait')).toBeNull()
    expect(queryByTestId('pp-hand-count')).toBeNull()
    expect(queryByTestId('commander-chip')).toBeNull()
    expect(container.querySelector('.life-counter .life-value')?.textContent).toBe('27')
    expect(container.querySelector('.badge-label')).toBeNull()
  })
})
