import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within, act } from '@testing-library/react'
import TournamentBracket from './TournamentBracket'
import ConfirmHost from '../ui/ConfirmHost'
import { switchLanguage } from '../i18n'
import { reset } from '../state/store'
import { setState } from '../state/state'
import type { TournamentView, TournamentPlayerView, TournamentGameView } from '../net/types'

const SWISS_TYPE = 'Constructed Swiss / Constructed - Modern 3 rounds'
const HISTORY = 'Matches: 41 (2%), Tourneys: 6 (0%), Constructed Rating: 1540, Limited Rating: 1490'

function game(
  roundNum: number,
  players: string,
  state: string,
  result: string,
  ids: { matchId: string; tableId?: string; gameId?: string },
): TournamentGameView {
  return {
    roundNum,
    players,
    state,
    result,
    matchId: ids.matchId,
    tableId: ids.tableId ?? `table-${ids.matchId}`,
    gameId: ids.gameId,
  }
}

function realView(overrides: Partial<TournamentView> = {}): TournamentView {
  const now = Date.now()
  const players: TournamentPlayerView[] = [
    { name: 'alice', flagName: 'es', state: 'Waiting for next round', points: 3, results: 'R1 bob [2-1] ', history: HISTORY, quit: false },
    { name: 'bob', flagName: 'us', state: 'Waiting for next round', points: 3, results: 'R1 alice [1-2] R2 charlie [2-0] ', history: '', quit: false },
    { name: 'charlie', flagName: 'de', state: 'Eliminated', points: 0, results: 'R1 diana [0-2] R2 bob [0-2] ', history: '', quit: true },
    { name: 'diana', flagName: 'fr', state: 'Dueling', points: 3, results: 'R1 charlie [2-0] ', history: '', quit: false },
  ]
  const rounds = [
    {
      games: [
        game(1, 'alice - bob', 'Finished (12:30)', 'Player alice is the winner', { matchId: 'r1-a', gameId: 'g1-1' }),
        game(1, 'alice - bob', 'Finished (10:02)', 'Player bob is the winner', { matchId: 'r1-a', gameId: 'g1-2' }),
        game(1, 'alice - bob', 'Finished (13:05)', 'Player alice is the winner', { matchId: 'r1-a', gameId: 'g1-3' }),
        game(1, 'charlie - diana', 'Finished (9:20)', 'Player diana is the winner', { matchId: 'r1-b', gameId: 'g1-4' }),
        game(1, 'charlie - diana', 'Finished (11:44)', 'Player diana is the winner', { matchId: 'r1-b', gameId: 'g1-5' }),
      ],
    },
    {
      games: [
        game(2, 'alice - diana', 'Finished (9:02)', 'Player alice is the winner', { matchId: 'r2-a', gameId: 'g2-1' }),
        game(2, 'alice - diana', 'Dueling (8:14)', '', { matchId: 'r2-a', gameId: 'g2-2', tableId: 'table-r2-a' }),
        game(2, 'bob - charlie', 'Finished (6:10)', 'Player bob is the winner', { matchId: 'r2-b', gameId: 'g2-3' }),
        game(2, 'bob - charlie', 'Finished (5:44)', 'Player bob is the winner', { matchId: 'r2-b', gameId: 'g2-4' }),
      ],
    },
  ]
  return {
    tournamentName: 'Modern Swiss #7',
    tournamentType: SWISS_TYPE,
    tournamentState: 'Dueling',
    startTime: now - 3600_000,
    endTime: null,
    stepStartTime: now - 120_000,
    serverTime: now,
    constructionTime: 600,
    watchingAllowed: true,
    rounds,
    players,
    runningInfo: '',
    ...overrides,
  }
}

function roundTab(label: string): HTMLElement {
  return screen.getAllByRole('tab').find((tab) => tab.textContent?.startsWith(label)) as HTMLElement
}

function playerRow(container: HTMLElement, name: string): HTMLElement {
  return within(container).getAllByTestId('standings-row').find((row) => row.textContent?.includes(name)) as HTMLElement
}

function setViewer(username: string | undefined) {
  setState({ conn: username ? { username } : undefined } as never)
}

describe('TournamentBracket', () => {
  beforeEach(async () => {
    reset()
    setViewer('zoe')
    await switchLanguage('en')
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('TRN-10: a best-of-three that went to three games is one card with the score 2–1', () => {
    render(<TournamentBracket view={realView()} />)
    fireEvent.click(roundTab('Round 1'))
    const cards = screen.getAllByTestId('bracket-match')
    expect(cards).toHaveLength(2)
    const aliceBob = cards[0]
    expect(aliceBob.textContent).toContain('alice')
    expect(aliceBob.textContent).toContain('Finished 2–1')
    expect(within(aliceBob).getAllByTestId('bracket-game-mark')).toHaveLength(3)
    expect(screen.getAllByTestId('bracket-match-wins').map((el) => el.textContent)).toEqual(['2', '1', '0', '2'])
  })

  it('TRN-10: a live match has a Watch button and a finished match has none', () => {
    const onWatchMatch = vi.fn()
    render(<TournamentBracket view={realView()} onWatchMatch={onWatchMatch} />)
    const watch = screen.getAllByTestId('bracket-watch')
    expect(watch).toHaveLength(1)
    expect(watch[0].getAttribute('data-table')).toBe('table-r2-a')
    expect(watch[0].textContent).toContain('Watch')
    fireEvent.click(watch[0])
    expect(onWatchMatch).toHaveBeenCalledWith('table-r2-a')
    fireEvent.click(roundTab('Round 1'))
    expect(screen.queryByTestId('bracket-watch')).toBeNull()
  })

  it('TRN-10: no card shows a table id or a round number chip', () => {
    const { container } = render(<TournamentBracket view={realView()} onWatchMatch={() => {}} />)
    fireEvent.click(roundTab('Round 1'))
    expect(container.textContent).not.toMatch(/table-/)
    expect(container.textContent).not.toMatch(/#R\d/)
    expect(container.textContent).not.toContain('Create Table')
  })

  it('TRN-10: the winner of a finished match is highlighted once and the live match shows its running game', () => {
    render(<TournamentBracket view={realView()} />)
    fireEvent.click(roundTab('Round 1'))
    const [first] = screen.getAllByTestId('bracket-match')
    const rows = within(first).getAllByTestId('bracket-match-player')
    expect(rows.map((row) => row.getAttribute('data-winner'))).toEqual(['true', 'false'])
    fireEvent.click(roundTab('Round 2'))
    const live = screen.getAllByTestId('bracket-match').find((card) => card.textContent?.includes('alice') && card.getAttribute('data-live') === 'true') as HTMLElement
    expect(live.textContent).toContain('Game 2 in progress · 8:14')
    const marks = within(live).getAllByTestId('bracket-game-mark')
    expect(marks.map((mark) => mark.getAttribute('data-state'))).toEqual(['done', 'live'])
  })

  it('TRN-11: a players string that does not split is shown as the server sent it', () => {
    const view = realView({
      rounds: [{ games: [game(1, 'alice vs bob', 'Finished (1:00)', 'Player alice is the winner', { matchId: 'odd' })] }],
    })
    render(<TournamentBracket view={view} />)
    expect(screen.getByTestId('bracket-match-raw').textContent).toBe('alice vs bob')
  })

  it('TRN-11: results that do not parse are shown verbatim in the rounds cell', () => {
    const view = realView({
      players: realView().players.map((p) => (p.name === 'alice' ? { ...p, results: 'chen 2-0 ???' } : p)),
    })
    const { container } = render(<TournamentBracket view={view} />)
    expect(within(playerRow(container, 'alice')).getByTestId('standings-raw-results').textContent).toBe('chen 2-0 ???')
  })

  it('TRN-12: a participant sees Your match with the opponent, the score and the standing', () => {
    setViewer('alice')
    render(<TournamentBracket view={realView()} />)
    const mine = screen.getByTestId('your-match')
    expect(mine.textContent).toContain('Your match')
    expect(mine.textContent).toContain('diana')
    expect(mine.textContent).toContain('Game 2 in progress · 8:14')
    expect(screen.getByTestId('your-standing').textContent).toContain('1st · 3 points')
    expect(screen.getByTestId('your-standing').textContent).toContain('Tied with 2 other players')
  })

  it('TRN-12: a spectator sees no Your match card and no leave action', () => {
    render(<TournamentBracket view={realView()} tournamentId="t-1" canQuit={false} />)
    expect(screen.queryByTestId('your-match')).toBeNull()
    expect(screen.queryByTestId('tournament-quit')).toBeNull()
  })

  it('TRN-12: between rounds the participant is told which round they wait for', () => {
    setViewer('bob')
    render(<TournamentBracket view={realView()} />)
    expect(screen.getByTestId('your-match-note').textContent).toBe('Waiting for round 2 to finish · 1 of 2 matches finished')
    cleanup()
    setViewer('charlie')
    const oneRound = realView({ rounds: [realView().rounds[0]] })
    render(<TournamentBracket view={oneRound} />)
    expect(screen.getByTestId('your-match-note').textContent).toBe('Round 1 is finished · waiting for round 2 to be paired')
  })

  it('TRN-13: the latest round is selected on open and its tab says how many matches finished', () => {
    render(<TournamentBracket view={realView()} />)
    expect(screen.getAllByRole('tab')).toHaveLength(3)
    expect(roundTab('Round 2').getAttribute('aria-selected')).toBe('true')
    expect(roundTab('Round 1').getAttribute('aria-selected')).toBe('false')
    expect(roundTab('Round 1').textContent).toContain('2 of 2 finished')
    expect(roundTab('Round 2').textContent).toContain('1 of 2 finished')
  })

  it('TRN-13: a round not paired yet is a tab whose panel says when it is paired', () => {
    render(<TournamentBracket view={realView()} />)
    expect(roundTab('Round 3').textContent).toContain('Not paired yet')
    fireEvent.click(roundTab('Round 3'))
    expect(screen.getByTestId('bracket-round').textContent).toContain('Round 3 is paired when round 2 ends')
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(roundTab('Round 3').id)
  })

  it('TRN-13: the round tabs move with the arrow keys', () => {
    render(<TournamentBracket view={realView()} />)
    const tablist = screen.getByRole('tablist')
    fireEvent.keyDown(tablist, { key: 'ArrowRight' })
    expect(roundTab('Round 3').getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(tablist, { key: 'ArrowLeft' })
    expect(roundTab('Round 2').getAttribute('aria-selected')).toBe('true')
  })

  it('TRN-14: a round mark carries the opponent and the score as its tooltip', () => {
    const { container } = render(<TournamentBracket view={realView()} />)
    const alice = playerRow(container, 'alice')
    const won = alice.querySelector('[data-mark="win"]') as HTMLElement
    expect(won.getAttribute('title')).toBe('R1 · bob 2–1')
    const playing = alice.querySelector('[data-mark="playing"]') as HTMLElement
    expect(playing.getAttribute('title')).toBe('R2 · playing now')
    const lost = playerRow(container, 'bob').querySelector('[data-mark="loss"]') as HTMLElement
    expect(lost.getAttribute('title')).toBe('R1 · alice 1–2')
  })

  it('TRN-14: a player who quit is struck through with quit inside the same name', () => {
    const { container } = render(<TournamentBracket view={realView()} />)
    const charlie = playerRow(container, 'charlie')
    const quit = within(charlie).getByTestId('standings-quit')
    expect(quit.textContent).toBe('Quit')
    expect(quit.parentElement).toBe(within(charlie).getByTestId('standings-name'))
    expect(within(charlie).getByTestId('standings-name').querySelector('.is-struck')?.textContent).toBe('charlie')
  })

  it('TRN-14: the profile history is a hover card on the name, not a column', () => {
    const { container } = render(<TournamentBracket view={realView()} />)
    expect(screen.queryByRole('columnheader', { name: 'History' })).toBeNull()
    const alice = playerRow(container, 'alice')
    const card = within(alice).getByTestId('standings-profile')
    expect(card.textContent).toContain('Matches: 41 (2% quit)')
    expect(card.textContent).toContain('Constructed 1540 · Limited 1490')
    expect(within(playerRow(container, 'bob')).queryByTestId('standings-profile')).toBeNull()
  })

  it('TRN-14: the flag is drawn from its code and the rows are ordered by points, keeping the server order on ties', () => {
    const { container } = render(<TournamentBracket view={realView()} />)
    expect(screen.getByAltText('ES').getAttribute('src')).toBe('/flags/es.png')
    const names = screen.getAllByTestId('standings-name').map((el) => el.querySelector('.standings-name-text')?.textContent)
    expect(names).toEqual(['alice', 'bob', 'diana', 'charlie'])
    expect(playerRow(container, 'alice').getAttribute('data-me')).toBe('false')
  })

  it('TRN-14: the viewer row is marked you and the state is short with the server text as tooltip', () => {
    setViewer('alice')
    const { container } = render(<TournamentBracket view={realView()} />)
    expect(playerRow(container, 'alice').getAttribute('data-me')).toBe('true')
    expect(within(playerRow(container, 'alice')).getByTestId('standings-you').textContent).toBe('you')
    const state = within(playerRow(container, 'bob')).getByTestId('standings-state')
    expect(state.textContent).toBe('Waiting')
    expect(state.getAttribute('title')).toBe('Waiting for next round')
  })

  it('TRN-15: the name appears once in the header and each time is labelled', () => {
    render(<TournamentBracket view={realView()} />)
    expect(screen.getAllByTestId('tournament-name')).toHaveLength(1)
    expect(screen.getByTestId('tournament-name').textContent).toBe('Modern Swiss #7')
    expect(screen.getByTestId('tournament-kicker').textContent).toBe('Swiss · Constructed · Modern')
    expect(screen.getByTestId('tournament-state').textContent).toBe('Round 2 in progress')
    expect(screen.getByTestId('tournament-timer').textContent).toMatch(/^Round started 0[12]:\d\d ago$/)
    expect(screen.getByTestId('tournament-players').textContent).toBe('4 players')
    expect(screen.getByTestId('tournament-watching').textContent).toBe('Spectators')
    expect(screen.getByTestId('tournament-dates').textContent).toMatch(/^Started /)
  })

  it('TRN-15: the construction countdown shows only while constructing', () => {
    const now = Date.now()
    const { unmount } = render(
      <TournamentBracket view={realView({ tournamentState: 'Constructing', stepStartTime: now - 120_000, serverTime: now, rounds: [] })} />,
    )
    expect(screen.getByTestId('tournament-construction').textContent).toBe('Construction: 08:00 left')
    unmount()
    cleanup()
    render(<TournamentBracket view={realView()} />)
    expect(screen.queryByTestId('tournament-construction')).toBeNull()
  })

  it('TRN-15: Updated N s ago is shown next to a refresh button that refreshes at once', () => {
    const onRefresh = vi.fn()
    render(<TournamentBracket view={realView()} updatedAt={Date.now() - 12_000} onRefresh={onRefresh} />)
    expect(screen.getByTestId('tournament-updated').textContent).toBe('Updated 12 s ago')
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('TRN-15: a clock that has not refreshed yet shows no Updated label', () => {
    render(<TournamentBracket view={realView()} />)
    expect(screen.queryByTestId('tournament-updated')).toBeNull()
  })

  it('TRN-16: only a participant sees Leave tournament, as the last element, and it asks first', async () => {
    const onQuit = vi.fn()
    const { container } = render(
      <>
        <TournamentBracket view={realView()} tournamentId="t-1" onQuit={onQuit} canQuit />
        <ConfirmHost />
      </>,
    )
    const leave = screen.getByTestId('tournament-quit')
    expect(leave.textContent).toBe('Leave tournament…')
    const root = container.querySelector('[data-testid="tournament-bracket"]') as HTMLElement
    expect(root.lastElementChild?.contains(leave)).toBe(true)
    fireEvent.click(leave)
    expect(await screen.findByTestId('confirm-modal')).not.toBeNull()
    expect(onQuit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('confirm-modal-ok'))
    await waitFor(() => expect(onQuit).toHaveBeenCalledWith('t-1'))
  })

  it('TRN-16: no leave action without a tournament id', () => {
    render(<TournamentBracket view={realView()} canQuit />)
    expect(screen.queryByTestId('tournament-quit')).toBeNull()
  })

  it('TRN-13: a tournament with no rounds and an unknown total shows the empty rounds state', () => {
    render(<TournamentBracket view={realView({ tournamentType: 'Swiss', rounds: [] })} />)
    expect(screen.getByTestId('tournament-no-rounds')).toBeDefined()
    expect(screen.queryByRole('tablist')).toBeNull()
  })

  it('TRN-14: a round that is being played shows the playing mark only for the players of a live match', () => {
    const { container } = render(<TournamentBracket view={realView()} />)
    expect(playerRow(container, 'diana').querySelector('[data-mark="playing"]')).not.toBeNull()
    expect(playerRow(container, 'bob').querySelector('[data-mark="playing"]')).toBeNull()
  })

  it('TRN-14: an empty round shows the empty state and a bye shows as B with its tooltip', () => {
    const view = realView({
      rounds: [{ games: [] }],
      players: realView().players.map((p) => (p.name === 'alice' ? { ...p, results: 'R1 Bye ' } : p)),
    })
    const { container } = render(<TournamentBracket view={view} />)
    expect(screen.getByTestId('bracket-round').textContent).toContain('No pairings yet')
    expect(playerRow(container, 'alice').querySelector('[data-mark="bye"]')?.getAttribute('title')).toBe('R1 · bye')
  })
})

describe('TournamentBracket — the in-game panel and the optional name', () => {
  beforeEach(async () => {
    reset()
    setViewer(undefined)
    await switchLanguage('en')
  })
  afterEach(() => cleanup())

  it('TRN-15: the name is left to the caller when showName is false', () => {
    render(<TournamentBracket view={realView()} showName={false} />)
    expect(screen.queryByTestId('tournament-name')).toBeNull()
    expect(screen.getByTestId('tournament-state')).toBeDefined()
  })

  it('TRN-16: the panel without canQuit shows no leave action', () => {
    render(<TournamentBracket view={realView()} tournamentId="t-1" canQuit={false} compact />)
    expect(screen.queryByTestId('tournament-quit')).toBeNull()
  })

  it('TRN-15: a refresh in progress disables the refresh button', () => {
    render(<TournamentBracket view={realView()} onRefresh={() => {}} refreshing />)
    expect((screen.getByRole('button', { name: 'Refresh' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('TRN-10: a watch in progress disables only the Watch button of that match', () => {
    render(<TournamentBracket view={realView()} onWatchMatch={() => {}} watchingMatchId="table-r2-a" />)
    expect((screen.getByTestId('bracket-watch') as HTMLButtonElement).disabled).toBe(true)
  })

  it('TRN-15: the Updated label keeps ticking', () => {
    vi.useFakeTimers()
    render(<TournamentBracket view={realView()} updatedAt={Date.now()} onRefresh={() => {}} />)
    expect(screen.getByTestId('tournament-updated').textContent).toBe('Updated 0 s ago')
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.getByTestId('tournament-updated').textContent).toBe('Updated 3 s ago')
  })
})

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

function constructingView(overrides: Partial<TournamentView> = {}): TournamentView {
  const now = Date.now()
  const base = (name: string, state: string): TournamentPlayerView => ({ name, flagName: 'es', state, points: 0, results: '', history: '', quit: false })
  return {
    tournamentName: 'Modern Swiss #7',
    tournamentType: SWISS_TYPE,
    tournamentState: 'Constructing',
    startTime: now - 600_000,
    endTime: null,
    stepStartTime: now - 120_000,
    serverTime: now,
    constructionTime: 600,
    watchingAllowed: true,
    rounds: [],
    players: [
      base('alice', 'Waiting for next round'),
      base('bob', 'Constructing'),
      base('charlie', 'Joined'),
      base('diana', 'Waiting for next round'),
    ],
    runningInfo: '',
    ...overrides,
  }
}

describe('TournamentBracket — construction, podium and the phone layout', () => {
  beforeEach(async () => {
    reset()
    setViewer('bob')
    await switchLanguage('en')
  })
  afterEach(() => {
    cleanup()
    delete (window as { matchMedia?: unknown }).matchMedia
  })

  it('TRN-18: while constructing the countdown, a progress bar and the ready list replace the empty rounds box', () => {
    render(<TournamentBracket view={constructingView()} />)
    expect(screen.getByTestId('construct-countdown').textContent).toBe('8:00')
    expect(screen.getByTestId('construct-total').textContent).toBe('left of 10:00')
    const bar = screen.getByRole('progressbar')
    expect(bar.getAttribute('aria-valuemin')).toBe('0')
    expect(bar.getAttribute('aria-valuemax')).toBe('600')
    expect(bar.getAttribute('aria-valuenow')).toBe('120')
    expect(screen.getByTestId('construct-ready').textContent).toBe('2 of 4 ready')
    const rows = screen.getAllByTestId('construct-player')
    expect(rows.map((row) => row.getAttribute('data-status'))).toEqual(['ready', 'building', 'other', 'ready'])
    expect(rows.map((row) => row.querySelector('.trn-construct-status')?.textContent)).toEqual(['✓ ready', 'building', 'Joined', '✓ ready'])
    expect(rows[1].getAttribute('data-me')).toBe('true')
    expect(rows[1].textContent).toContain('you')
    expect(screen.getByTestId('construct-note').textContent).toBe('Round 1 is paired when every deck is in or time runs out')
  })

  it('TRN-18: no empty rounds box or round tabs appear while constructing', () => {
    render(<TournamentBracket view={constructingView()} />)
    expect(screen.queryByTestId('tournament-no-rounds')).toBeNull()
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.queryByText('No rounds generated yet — awaiting pairings.')).toBeNull()
  })

  it('TRN-18: during the draft the rounds area shows the running state instead of tabs', () => {
    const view = constructingView({ tournamentState: 'Drafting', runningInfo: 'Booster 2 of 3 · pick 5/15' })
    render(<TournamentBracket view={view} />)
    expect(screen.getByTestId('draft-panel').textContent).toContain('Booster 2 of 3 · pick 5/15')
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.queryByTestId('tournament-running-info')).toBeNull()
  })

  it('TRN-18: a finished Swiss tournament shows its podium above the standings, the phase and the time span', () => {
    const now = Date.now()
    const players: TournamentPlayerView[] = [
      { name: 'alice', flagName: 'es', state: 'Finished', points: 9, results: 'R1 bob [2-1] ', history: '', quit: false },
      { name: 'bob', flagName: 'us', state: 'Finished', points: 6, results: 'R1 alice [1-2] ', history: '', quit: false },
      { name: 'charlie', flagName: 'de', state: 'Finished', points: 0, results: 'R1 diana [0-2] ', history: '', quit: false },
      { name: 'diana', flagName: 'fr', state: 'Finished', points: 6, results: 'R1 charlie [2-0] ', history: '', quit: false },
    ]
    render(<TournamentBracket view={realView({ tournamentState: 'Finished', endTime: now, players, rounds: realView().rounds.slice(0, 1) })} />)
    expect(screen.getByTestId('tournament-state').textContent).toBe('Finished')
    expect(screen.getByTestId('tournament-dates').textContent).toMatch(/^From .+ to .+$/)
    const standings = screen.getByTestId('bracket-standings-section')
    const podium = within(standings).getByTestId('tournament-podium')
    expect(podium.classList.contains('is-champion')).toBe(false)
    const places = within(podium).getAllByTestId('podium-place')
    expect(places.map((place) => place.getAttribute('data-rank'))).toEqual(['1', '2', '3'])
    expect(places.map((place) => place.querySelector('.trn-podium-name')?.textContent)).toEqual(['alice', 'bob', 'diana'])
    expect(places[0].textContent).toContain('1st')
    expect(screen.queryByTestId('bracket-rounds-section')?.contains(podium)).toBe(false)
  })

  it('TRN-18: a finished elimination tournament highlights its champion above the standings', () => {
    const players: TournamentPlayerView[] = [
      { name: 'p1', flagName: 'es', state: 'Finished', points: 3, results: 'R1 p2 [2-0] ', history: '', quit: false },
      { name: 'p2', flagName: 'us', state: 'Eliminated', points: 0, results: 'R1 p1 [0-2] ', history: '', quit: false },
    ]
    const view = realView({
      tournamentType: 'Booster Draft Elimination',
      tournamentState: 'Finished',
      endTime: Date.now(),
      players,
      rounds: [{ games: [game(1, 'p1 - p2', 'Finished (5:00)', 'Player p1 is the winner', { matchId: 'final' })] }],
    })
    render(<TournamentBracket view={view} />)
    const podium = screen.getByTestId('tournament-podium')
    expect(podium.classList.contains('is-champion')).toBe(true)
    expect(podium.textContent).toContain('Champion')
    expect(podium.textContent).toContain('p1')
    expect(screen.getByTestId('tree-champion-name').textContent).toBe('p1')
  })

  it('TRN-10: each game mark says who won it in words and by an initial, not only by colour', () => {
    render(<TournamentBracket view={realView()} />)
    fireEvent.click(roundTab('Round 1'))
    const [aliceBob] = within(screen.getByTestId('bracket-round')).getAllByTestId('bracket-match')
    const marks = within(aliceBob).getAllByTestId('bracket-game-mark')
    expect(marks.map((mark) => mark.querySelector('[aria-hidden="true"]')?.textContent)).toEqual(['1 A', '2 B', '3 A'])
    expect(marks.map((mark) => mark.getAttribute('title'))).toEqual(['Game 1 · won by alice', 'Game 2 · won by bob', 'Game 3 · won by alice'])
    const rows = within(aliceBob).getAllByTestId('bracket-match-player')
    expect(rows[0].textContent).toContain('winner')
    expect(rows[1].textContent).not.toContain('winner')
  })

  it('TRN-19: on a narrow screen Rounds and Standings are a switch that shows one at a time', () => {
    narrowScreen(true)
    const { container } = render(<TournamentBracket view={realView()} />)
    expect(screen.getByTestId('bracket-switch')).not.toBeNull()
    expect(screen.getByTestId('bracket-rounds-section')).not.toBeNull()
    expect(screen.queryByTestId('bracket-standings-section')).toBeNull()
    expect(screen.getByTestId('switch-rounds').getAttribute('aria-selected')).toBe('true')
    fireEvent.click(screen.getByTestId('switch-standings'))
    expect(screen.queryByTestId('bracket-rounds-section')).toBeNull()
    expect(screen.getByTestId('bracket-standings-section')).not.toBeNull()
    expect(screen.getByTestId('switch-standings').getAttribute('aria-selected')).toBe('true')
    expect(container.querySelector('.tournament-bracket.is-phone')).not.toBeNull()
  })

  it('TRN-19: on a wide screen both sections are shown and there is no switch', () => {
    narrowScreen(false)
    render(<TournamentBracket view={realView()} />)
    expect(screen.queryByTestId('bracket-switch')).toBeNull()
    expect(screen.getByTestId('bracket-rounds-section')).not.toBeNull()
    expect(screen.getByTestId('bracket-standings-section')).not.toBeNull()
  })
})

function eliminationView(overrides: Partial<TournamentView> = {}): TournamentView {
  const players: TournamentPlayerView[] = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'].map((name, i) => ({
    name,
    flagName: 'es',
    state: i < 4 ? 'Waiting for next round' : 'Eliminated',
    points: i < 4 ? 3 : 0,
    results: '',
    history: '',
    quit: false,
  }))
  return realView({
    tournamentType: 'Booster Draft Elimination',
    tournamentState: 'Dueling',
    players,
    rounds: [
      {
        games: [
          game(1, 'p1 - p2', 'Finished (5:00)', 'Player p1 is the winner', { matchId: 'qf-1' }),
          game(1, 'p3 - p4', 'Finished (5:00)', 'Player p3 is the winner', { matchId: 'qf-2' }),
          game(1, 'p5 - p6', 'Finished (5:00)', 'Player p5 is the winner', { matchId: 'qf-3' }),
          game(1, 'p7 - p8', 'Finished (5:00)', 'Player p7 is the winner', { matchId: 'qf-4' }),
        ],
      },
      {
        games: [
          game(2, 'p1 - p3', 'Dueling (2:00)', '', { matchId: 'sf-1', gameId: 'g-sf-1' }),
          game(2, 'p5 - p7', 'Finished (5:00)', 'Player p5 is the winner', { matchId: 'sf-2' }),
        ],
      },
    ],
    ...overrides,
  })
}

describe('TournamentBracket — elimination layout, phase names and standings while constructing (TRN-13, TRN-18)', () => {
  beforeEach(async () => {
    reset()
    setViewer('zoe')
    await switchLanguage('en')
  })
  afterEach(() => {
    cleanup()
    delete (window as { matchMedia?: unknown }).matchMedia
  })

  it('TRN-13: an elimination tournament names the round in progress instead of its number', () => {
    render(<TournamentBracket view={eliminationView()} />)
    expect(screen.getByTestId('tournament-state').textContent).toBe('Semifinal in progress')
  })

  it('TRN-13: a Swiss tournament keeps the round number in its phase chip', () => {
    render(<TournamentBracket view={realView()} />)
    expect(screen.getByTestId('tournament-state').textContent).toBe('Round 2 in progress')
  })

  it('TRN-13: an elimination bracket is marked for the full-width layout, with the standings after the tree', () => {
    const { container } = render(<TournamentBracket view={eliminationView()} />)
    expect(container.querySelector('.tournament-bracket')?.classList.contains('is-elimination')).toBe(true)
    const rounds = screen.getByTestId('bracket-rounds-section')
    const standings = screen.getByTestId('bracket-standings-section')
    expect(within(rounds).getByTestId('elimination-tree')).toBeDefined()
    expect(rounds.compareDocumentPosition(standings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('TRN-13: a Swiss bracket is not marked as an elimination layout', () => {
    const { container } = render(<TournamentBracket view={realView()} />)
    expect(container.querySelector('.tournament-bracket')?.classList.contains('is-elimination')).toBe(false)
  })

  it('TRN-18: while constructing the standings say Ready and Building, not Waiting and Constructing', () => {
    render(<TournamentBracket view={constructingView()} />)
    const states = screen.getAllByTestId('standings-state').map((cell) => cell.textContent)
    expect(states).toEqual(['Ready', 'Building', 'Waiting', 'Ready'])
  })

  it('TRN-18: once the tournament is dueling the standings keep the server state names', () => {
    render(<TournamentBracket view={realView()} />)
    expect(screen.getAllByTestId('standings-state').map((cell) => cell.textContent)).not.toContain('Ready')
  })
})
