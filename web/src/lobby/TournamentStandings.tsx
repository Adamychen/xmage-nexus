import { useId, type ReactNode } from 'react'
import type { TournamentPlayerView, TournamentView } from '../net/types'
import Chip from '../ui/Chip'
import EmptyState from '../ui/EmptyState'
import CountryFlag from './CountryFlag'
import { t, useTranslation } from '../i18n'
import { stateLabel } from './lobbyUtils'
import { currentRoundIndex, sortStandings } from './tournament/matches'
import { parsePlayerResults, parsePlayerState, parseProfileHistory, tournamentPhase, type PlayerStateKind, type RoundResult } from './tournament/parse'
import { currentRoundMatches } from './tournamentPresentation'

interface Props {
  view: TournamentView
  viewer?: string
}

type MarkKind = 'win' | 'loss' | 'draw' | 'bye' | 'playing' | 'none'

const MARK_KEYS = {
  win: 'trn_b_mark_win',
  loss: 'trn_b_mark_loss',
  draw: 'trn_b_mark_draw',
  bye: 'trn_b_mark_bye',
  playing: 'trn_b_mark_playing',
} as const

const STATE_KEYS: Partial<Record<PlayerStateKind, 'table_state_waiting' | 'table_state_drafting' | 'table_state_constructing' | 'table_state_dueling' | 'table_state_sideboarding' | 'table_state_eliminated' | 'table_state_finished'>> = {
  joined: 'table_state_waiting',
  waiting: 'table_state_waiting',
  drafting: 'table_state_drafting',
  constructing: 'table_state_constructing',
  dueling: 'table_state_dueling',
  sideboarding: 'table_state_sideboarding',
  eliminated: 'table_state_eliminated',
  finished: 'table_state_finished',
}

function shortState(kind: PlayerStateKind, raw: string, constructing: boolean): string {
  if (kind === 'canceled') return t('lobby', 'trn_b_state_canceled')
  if (constructing && kind === 'waiting') return t('lobby', 'trn_f_state_ready')
  if (constructing && kind === 'constructing') return t('lobby', 'trn_f_state_building')
  const key = STATE_KEYS[kind]
  return key ? t('lobby', key) : stateLabel(t, raw)
}

function roundMarkContent(kind: MarkKind, tip: string): ReactNode {
  if (kind === 'none') return <span className="standings-mark is-none" aria-hidden="true">–</span>
  return (
    <span className={`standings-mark is-${kind}`} title={tip} aria-label={tip} data-mark={kind}>
      {t('lobby', MARK_KEYS[kind])}
    </span>
  )
}

function markFor(result: RoundResult | undefined, roundIndex: number, current: number, playing: boolean): { kind: MarkKind; tip: string } {
  if (result?.bye) return { kind: 'bye', tip: t('lobby', 'trn_b_mark_tip_bye', { round: roundIndex + 1 }) }
  if (result) {
    const score = `${result.wins}–${result.losses}`
    return { kind: result.outcome, tip: t('lobby', 'trn_b_mark_tip', { round: roundIndex + 1, opponent: result.opponent ?? '', score }) }
  }
  if (roundIndex === current && playing) return { kind: 'playing', tip: t('lobby', 'trn_b_mark_tip_playing', { round: roundIndex + 1 }) }
  return { kind: 'none', tip: '' }
}

function RoundMarks({ player, view, current, playing }: { player: TournamentPlayerView; view: TournamentView; current: number; playing: boolean }) {
  const results = parsePlayerResults(player.results)
  if (results === null) {
    return <span className="standings-raw" data-testid="standings-raw-results">{player.results}</span>
  }
  return (
    <span className="standings-marks" data-testid="standings-marks">
      {view.rounds.map((_, roundIndex) => {
        const result = results.find((r) => r.round === roundIndex + 1)
        const { kind, tip } = markFor(result, roundIndex, current, playing)
        return <span key={roundIndex}>{roundMarkContent(kind, tip)}</span>
      })}
    </span>
  )
}

function ProfileCard({ id, history }: { id: string; history: string }) {
  const { t: translate } = useTranslation()
  const profile = parseProfileHistory(history)
  return (
    <span id={id} role="tooltip" className="standings-profile" data-testid="standings-profile">
      <strong className="standings-profile-title">{translate('lobby', 'trn_b_profile_title')}</strong>
      {profile ? (
        <>
          <span>{translate('lobby', 'trn_b_profile_matches', { count: profile.matches, pct: profile.matchQuitPct })}</span>
          <span>{translate('lobby', 'trn_b_profile_tourneys', { count: profile.tourneys, pct: profile.tourneyQuitPct })}</span>
          <span>{translate('lobby', 'trn_b_profile_ratings', { constructed: profile.constructedRating, limited: profile.limitedRating })}</span>
        </>
      ) : (
        <span>{history}</span>
      )}
    </span>
  )
}

export default function TournamentStandings({ view, viewer }: Props) {
  const { t: translate } = useTranslation()
  const idBase = useId().replace(/:/g, '')
  const rows = sortStandings(view.players)
  if (rows.length === 0) {
    return <EmptyState size="sm" data-testid="standings-empty">{translate('lobby', 'standings_empty')}</EmptyState>
  }
  const current = currentRoundIndex(view)
  const constructing = tournamentPhase(view.tournamentState) === 'constructing'
  const playing = new Set<string>()
  for (const match of currentRoundMatches(view)) {
    if (match.live && match.players) match.players.forEach((name) => playing.add(name))
  }
  return (
    <div className="tournament-standings-wrap" data-testid="tournament-standings">
      <table className="tournament-standings-table" data-testid="standings-table">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">{translate('lobby', 'leaderboard_col_player')}</th>
            <th scope="col">{translate('lobby', 'leaderboard_col_points')}</th>
            <th scope="col">{translate('lobby', 'leaderboard_col_results')}</th>
            <th scope="col">{translate('lobby', 'leaderboard_col_status')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, idx) => {
            const isMe = viewer === p.name
            const hasProfile = !!p.history?.trim()
            const cardId = `${idBase}-profile-${idx}`
            const state = parsePlayerState(p.state)
            const classes = ['standings-row', p.quit ? 'is-quit' : '', isMe ? 'is-me' : ''].filter(Boolean).join(' ')
            return (
              <tr key={`${p.name}-${idx}`} className={classes} data-testid="standings-row" data-quit={p.quit ? 'true' : 'false'} data-me={isMe ? 'true' : 'false'}>
                <td className="standings-rank">{idx + 1}</td>
                <td className="standings-name-cell">
                  <span
                    className="standings-name"
                    data-testid="standings-name"
                    tabIndex={hasProfile ? 0 : undefined}
                    aria-describedby={hasProfile ? cardId : undefined}
                  >
                    <CountryFlag flagName={p.flagName} />
                    <span className={`standings-name-text ${p.quit ? 'is-struck' : ''}`}>{p.name}</span>
                    {isMe && <Chip tone="brand" size="xs" data-testid="standings-you">{translate('lobby', 'trn_b_you')}</Chip>}
                    {p.quit && <Chip tone="err" size="xs" data-testid="standings-quit">{translate('lobby', 'standings_quit_badge')}</Chip>}
                    {hasProfile && <ProfileCard id={cardId} history={p.history ?? ''} />}
                  </span>
                </td>
                <td className="standings-points" data-testid="standings-points">{p.points}</td>
                <td className="standings-results">
                  <RoundMarks player={p} view={view} current={current} playing={playing.has(p.name)} />
                </td>
                <td className="standings-state" data-testid="standings-state" title={state.raw}>
                  <span className={`standings-dot is-${state.kind}`} aria-hidden="true" />
                  <span>{shortState(state.kind, p.state, constructing)}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
