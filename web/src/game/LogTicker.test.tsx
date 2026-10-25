import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LogTicker from './LogTicker'
import CombatLedger from './CombatLedger'
import { ChromeActionsContext } from './chromeActions'
import { setState } from '../state/state'
import { resetCommanderMemory } from '../board/commanders'
import { makeCard, makeGameView, makePlayer } from '../__fixtures__/gameViews'
import { emphasize, tickerLines } from './logTickerModel'
import type { ActionFeedItem } from './gameEventParser'
import { loadLogTickerExpanded, saveLogTickerExpanded } from '../state/persistence'

function log(...lines: string[]) {
  return lines.map((text, i) => ({ id: i + 1, time: 1000 + i, text, from: 'game', channel: 'game' as const }))
}

describe('LogTicker', () => {
  beforeEach(() => {
    saveLogTickerExpanded(false)
    setState({ game: makeGameView({ players: [makePlayer({ playerId: 'a', name: 'Adam', controlled: true })] }) })
  })
  afterEach(() => {
    cleanup()
    setState({ log: [], game: null })
  })

  it('renders nothing while the log is empty', () => {
    setState({ log: [] })
    const { container } = render(<LogTicker />)
    expect(container.querySelector('[data-testid="log-ticker"]')).toBeNull()
  })

  it('BRD-17: starts collapsed to the newest action only, and opens the log panel on click', () => {
    setState({ log: log('Adam plays Forest', 'Adam plays Swamp', 'Mira casts Counterspell', 'Tobias casts Lightning Bolt', 'Adam casts Pact of Negation') })
    const openPanel = vi.fn()
    const { getAllByTestId, getByTestId } = render(
      <ChromeActionsContext.Provider value={{ openPanel, sidePanelOpen: false }}>
        <LogTicker />
      </ChromeActionsContext.Provider>,
    )
    expect(getByTestId('log-ticker').getAttribute('data-expanded')).toBe('0')
    expect(getAllByTestId('log-ticker-line')).toHaveLength(1)
    expect(getAllByTestId('log-ticker-line')[0].textContent).toContain('Pact of Negation')
    expect(getByTestId('log-ticker-toggle').getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(getByTestId('log-ticker'))
    expect(openPanel).toHaveBeenCalledWith('log')
  })

  it('BRD-17: the toggle expands to the last four actions, newest first, remembers it, and does not open the log panel', () => {
    setState({ log: log('Adam plays Forest', 'Adam plays Swamp', 'Mira casts Counterspell', 'Tobias casts Lightning Bolt', 'Adam casts Pact of Negation') })
    const openPanel = vi.fn()
    const { getAllByTestId, getByTestId, unmount } = render(
      <ChromeActionsContext.Provider value={{ openPanel, sidePanelOpen: false }}>
        <LogTicker />
      </ChromeActionsContext.Provider>,
    )
    fireEvent.click(getByTestId('log-ticker-toggle'))
    expect(openPanel).not.toHaveBeenCalled()
    expect(loadLogTickerExpanded()).toBe(true)
    expect(getByTestId('log-ticker-toggle').getAttribute('aria-expanded')).toBe('true')
    const lines = getAllByTestId('log-ticker-line')
    expect(lines).toHaveLength(4)
    expect(lines[0].className).toContain('age-0')
    expect(lines[0].textContent).toContain('Pact of Negation')
    expect(lines[3].textContent).toContain('Swamp')
    expect(lines[0].querySelector('b')?.textContent).toBe('Adam')
    unmount()

    const again = render(<LogTicker />)
    expect(again.getAllByTestId('log-ticker-line')).toHaveLength(4)
    fireEvent.click(again.getByTestId('log-ticker-toggle'))
    expect(again.getAllByTestId('log-ticker-line')).toHaveLength(1)
    expect(loadLogTickerExpanded()).toBe(false)
  })
})

describe('tickerLines', () => {
  const players = [makePlayer({ playerId: 'a', name: 'Adam', controlled: true }), makePlayer({ playerId: 'm', name: 'Mira' })]
  const item = (id: string, type: ActionFeedItem['type'], description: string, extra: Partial<ActionFeedItem> = {}): ActionFeedItem =>
    ({ id, type, description, rawText: description, timestamp: 0, ...extra })

  it('drops turn, phase and chat lines and puts the newest first', () => {
    const lines = tickerLines([
      item('1', 'land', 'Adam plays Swamp', { playerName: 'Adam' }),
      item('2', 'turn', 'Turn 8 Mira'),
      item('3', 'chat', 'gg'),
      item('4', 'cast', 'Mira casts Counterspell', { playerName: 'Mira', cardName: 'Counterspell' }),
    ], players)
    expect(lines.map((l) => l.id)).toEqual(['4', '1'])
    expect(lines.map((l) => l.ownerId)).toEqual(['m', 'a'])
  })

  it('finds the owner by the leading name when the parser has none', () => {
    expect(tickerLines([item('1', 'system', 'Mira draws a card')], players)[0].ownerId).toBe('m')
    expect(tickerLines([item('1', 'system', 'Nobody does a thing')], players)[0].ownerId).toBeNull()
  })

  it('falls back to the controller of the named card for lines that start with a card', () => {
    const withBoard = [makePlayer({ playerId: 'a', name: 'Adam', controlled: true, battlefield: { k: makeCard({ id: 'k', name: 'Korvold' }) } })]
    expect(tickerLines([item('1', 'damage', 'Korvold deals 7 damage to Cathar', { cardName: 'Korvold' })], withBoard)[0].ownerId).toBe('a')
  })

  it('bolds the player, card and target names without overlapping spans', () => {
    expect(emphasize('Adam casts Lightning Bolt targeting Edgar Markov', ['Adam', 'Lightning Bolt', 'Edgar Markov', 'Bolt'])).toEqual([
      { text: 'Adam', strong: true },
      { text: ' casts ', strong: false },
      { text: 'Lightning Bolt', strong: true },
      { text: ' targeting ', strong: false },
      { text: 'Edgar Markov', strong: true },
    ])
  })
})

describe('CombatLedger', () => {
  const players = [makePlayer({ playerId: 'a', name: 'Adam', controlled: true }), makePlayer({ playerId: 't', name: 'Tobias' })]
  const combatLog = log('Turn 7 Adam', 'Tobias attacks Adam with Edgar Markov', 'Edgar Markov deals 4 damage to Adam', 'Vampire deals 2 damage to Adam')

  afterEach(() => {
    cleanup()
    resetCommanderMemory()
    setState({ log: [], game: null })
  })

  it('stays hidden outside the combat damage window', () => {
    setState({ log: combatLog, game: makeGameView({ players, step: 'DECLARE_BLOCKERS', turn: 7 }) })
    const { container } = render(<CombatLedger />)
    expect(container.querySelector('[data-testid="combat-ledger"]')).toBeNull()
  })

  it('lists the damage during the damage step and can be dismissed for the turn', () => {
    setState({ log: combatLog, game: makeGameView({ players, step: 'COMBAT_DAMAGE', turn: 7 }) })
    const { getAllByTestId, getByTestId, container } = render(<CombatLedger />)
    expect(getAllByTestId('combat-ledger-row')).toHaveLength(2)
    expect(getByTestId('combat-ledger-total').textContent).toBe('Adam 26 → 20')
    fireEvent.click(container.querySelector('.combat-ledger-head button') as Element)
    expect(container.querySelector('[data-testid="combat-ledger"]')).toBeNull()
  })
})
