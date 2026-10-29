import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import TournamentEliminationTree from './TournamentEliminationTree'
import TournamentBracket from './TournamentBracket'
import { switchLanguage } from '../i18n'
import { reset } from '../state/store'
import type { TournamentGameView, TournamentPlayerView, TournamentView } from '../net/types'

const TYPE = 'Booster Draft Elimination'

function game(roundNum: number, players: string, matchId: string, result: string, state = 'Finished (5:00)'): TournamentGameView {
  return { roundNum, players, state, result, matchId, tableId: `table-${matchId}`, gameId: `game-${matchId}` }
}

function player(name: string, results: string, state = 'Waiting for next round'): TournamentPlayerView {
  return { name, flagName: 'es', state, points: 0, results, history: '', quit: false }
}

const PLAYERS: TournamentPlayerView[] = [
  player('p1', 'R1 p2 [1-0] '),
  player('p2', 'R1 p1 [0-1] '),
  player('p3', 'R1 p4 [0-1] '),
  player('p4', 'R1 p3 [1-0] '),
  player('p5', 'R1 p6 [1-0] '),
  player('p6', 'R1 p5 [0-1] '),
  player('p7', 'R1 p8 [0-1] '),
  player('p8', 'R1 p7 [1-0] '),
]

const ROUND_ONE = {
  games: [
    game(1, 'p1 - p2', 'a', 'Player p1 is the winner'),
    game(1, 'p3 - p4', 'b', 'Player p4 is the winner'),
    game(1, 'p5 - p6', 'c', 'Player p5 is the winner'),
    game(1, 'p7 - p8', 'd', 'Player p8 is the winner'),
  ],
}

function view(overrides: Partial<TournamentView> = {}): TournamentView {
  const now = Date.now()
  return {
    tournamentName: 'Draft Elimination #3',
    tournamentType: TYPE,
    tournamentState: 'Dueling',
    startTime: now - 3600_000,
    endTime: null,
    stepStartTime: now - 120_000,
    serverTime: now,
    constructionTime: 600,
    watchingAllowed: true,
    rounds: [ROUND_ONE],
    players: PLAYERS,
    runningInfo: '',
    ...overrides,
  }
}

function renderTree(v: TournamentView, stacked = false) {
  return render(<TournamentEliminationTree view={v} canWatch={false} stacked={stacked} />)
}

function narrowScreen(on: boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: on && query === '(max-width: 600px)',
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

describe('TournamentEliminationTree', () => {
  beforeEach(async () => {
    reset()
    await switchLanguage('en')
  })
  afterEach(() => {
    cleanup()
    delete (window as { matchMedia?: unknown }).matchMedia
  })

  it('TRN-13: the tree has one column per round, titled from the final backwards, and the champion box at the end', () => {
    const { container } = renderTree(view())
    const rounds = screen.getAllByTestId('tree-round')
    expect(rounds).toHaveLength(3)
    expect(rounds.map((round) => round.querySelector('h4')?.textContent)).toEqual(['Quarterfinal', 'Semifinal', 'Final'])
    expect(screen.getByRole('heading', { name: 'Quarterfinal' })).not.toBeNull()
    const champion = screen.getByTestId('tree-champion')
    expect(champion.querySelector('h4')?.textContent).toBe('Champion')
    expect(screen.getByTestId('tree-champion-box').textContent).toBe('Champion: to be decided')
    expect(container.querySelectorAll('[data-testid="tree-round"] [data-testid="tree-slot"]')).toHaveLength(7)
  })

  it('TRN-13: a round listed in the reverse order of its feeders is drawn under the matches its players came from', () => {
    const v = view({
      rounds: [
        ROUND_ONE,
        { games: [game(2, 'p5 - p8', 'y', 'Player p5 is the winner'), game(2, 'p1 - p4', 'x', 'Player p1 is the winner')] },
      ],
    })
    renderTree(v)
    const semifinal = screen.getAllByTestId('tree-round')[1]
    const slots = within(semifinal).getAllByTestId('tree-slot')
    expect(slots[0].textContent).toContain('p1')
    expect(slots[0].textContent).toContain('p4')
    expect(slots[1].textContent).toContain('p5')
    expect(slots[1].textContent).toContain('p8')
  })

  it('TRN-13: every pair of feeders is joined to the match it feeds by a connector, and the final to the champion box', () => {
    const { container } = renderTree(view())
    const links = container.querySelectorAll('svg.trn-tree-link')
    expect(links).toHaveLength(3)
    links.forEach((link) => {
      expect(link.getAttribute('aria-hidden')).toBe('true')
      expect(link.querySelector('path')?.getAttribute('d')).toMatch(/^M0 [\d.]+ H12/)
    })
    expect(links[0].querySelector('path')?.getAttribute('d')).toBe(
      'M0 12.5 H12 V37.5 M0 37.5 H12 M12 25 H24 M0 62.5 H12 V87.5 M0 87.5 H12 M12 75 H24',
    )
    expect(links[2].querySelector('path')?.getAttribute('d')).toBe('M0 50 H12 M12 50 H24')
  })

  it('TRN-13: an empty slot whose two feeders are decided names both winners, and a slot with nobody to wait for says so', () => {
    renderTree(view())
    const semifinal = screen.getAllByTestId('tree-round')[1]
    expect(within(semifinal).getAllByTestId('tree-placeholder').map((el) => el.textContent)).toEqual(['p1 vs p4', 'p5 vs p8'])
    const quarterfinal = screen.getAllByTestId('tree-round')[0]
    expect(within(quarterfinal).queryByTestId('tree-placeholder')).toBeNull()
    expect(screen.getAllByTestId('tree-placeholder').map((el) => el.textContent)).toEqual(['p1 vs p4', 'p5 vs p8', 'To be decided'])
  })

  it('TRN-13: a later-round slot with one decided feeder names the winner by name and the other side as the winner of its two players', () => {
    renderTree(view({
      rounds: [{
        games: [
          game(1, 'p1 - p2', 'a', 'Player p1 is the winner'),
          game(1, 'p3 - p4', 'b', '', 'Dueling (3:00)'),
          game(1, 'p5 - p6', 'c', 'Player p5 is the winner'),
          game(1, 'p7 - p8', 'd', 'Player p8 is the winner'),
        ],
      }],
    }))
    const semifinal = screen.getAllByTestId('tree-round')[1]
    expect(within(semifinal).getAllByTestId('tree-placeholder').map((el) => el.textContent)).toEqual(['p1 vs winner of p3 / p4', 'p5 vs p8'])
  })

  it('TRN-13: a later-round slot whose feeders are both undecided names the two pairs it waits for', () => {
    renderTree(view({
      rounds: [{
        games: [
          game(1, 'p1 - p2', 'a', '', 'Dueling (3:00)'),
          game(1, 'p3 - p4', 'b', '', 'Dueling (4:00)'),
          game(1, 'p5 - p6', 'c', 'Player p5 is the winner'),
          game(1, 'p7 - p8', 'd', 'Player p8 is the winner'),
        ],
      }],
    }))
    const semifinal = screen.getAllByTestId('tree-round')[1]
    expect(within(semifinal).getAllByTestId('tree-placeholder').map((el) => el.textContent)).toEqual(['winner of p1 / p2 vs winner of p3 / p4', 'p5 vs p8'])
  })

  it('TRN-13: the champion box names the winner of a finished final, and the losers of finished matches are dimmed', () => {
    const v = view({
      rounds: [
        ROUND_ONE,
        { games: [game(2, 'p1 - p4', 'x', 'Player p1 is the winner')] },
        { games: [game(3, 'p1 - p5', 'f', 'Player p1 is the winner')] },
      ],
      players: [
        player('p1', 'R1 p2 [1-0] R2 p4 [1-0] R3 p5 [1-0] ', 'Finished'),
        player('p2', 'R1 p1 [0-1] ', 'Eliminated'),
        player('p3', 'R1 p4 [0-1] ', 'Eliminated'),
        player('p4', 'R1 p3 [1-0] R2 p1 [0-1] ', 'Eliminated'),
        player('p5', 'R1 p6 [1-0] R3 p1 [0-1] ', 'Eliminated'),
        player('p6', 'R1 p5 [0-1] ', 'Eliminated'),
        player('p7', 'R1 p8 [0-1] ', 'Eliminated'),
        player('p8', 'R1 p7 [1-0] ', 'Eliminated'),
      ],
      tournamentState: 'Finished',
    })
    const { container } = renderTree(v)
    expect(screen.getByTestId('tree-champion-name').textContent).toBe('p1')
    expect(screen.getByTestId('tree-champion-box').classList.contains('is-decided')).toBe(true)
    expect(container.querySelectorAll('.trn-match-row.is-out')).toHaveLength(6)
    expect(container.querySelectorAll('.trn-match-row.is-winner')).toHaveLength(6)
  })

  it('TRN-13: stacked for a phone, the tree is one list per round with no connectors', () => {
    const { container } = renderTree(view(), true)
    expect(container.querySelector('.trn-tree.is-stacked')).not.toBeNull()
    expect(container.querySelectorAll('svg.trn-tree-link')).toHaveLength(0)
    expect(screen.getAllByTestId('tree-round')).toHaveLength(3)
    expect(screen.getAllByTestId('tree-slot')).toHaveLength(7)
  })

  it('TRN-13: an elimination tournament shows the tree instead of round tabs, and on a phone the stacked list', () => {
    narrowScreen(true)
    const { unmount } = render(<TournamentBracket view={view()} />)
    expect(screen.queryByRole('tablist', { name: 'Rounds' })).toBeNull()
    expect(screen.getByTestId('elimination-tree').closest('.tournament-bracket')?.classList.contains('is-phone')).toBe(true)
    expect(document.querySelector('.trn-tree.is-stacked')).not.toBeNull()
    expect(document.querySelectorAll('svg.trn-tree-link')).toHaveLength(0)
    unmount()
    narrowScreen(false)
    render(<TournamentBracket view={view()} />)
    expect(document.querySelector('.trn-tree.is-stacked')).toBeNull()
    expect(document.querySelectorAll('svg.trn-tree-link')).toHaveLength(3)
  })
})
