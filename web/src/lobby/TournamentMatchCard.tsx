import Button from '../ui/Button'
import Chip from '../ui/Chip'
import Icon from '../ui/Icon'
import { t, useTranslation } from '../i18n'
import type { MatchSummary, MatchGameSummary } from './tournament/matches'
import { initialOf } from './tournamentPresentation'

export interface TournamentMatchCardProps {
  match: MatchSummary
  viewer?: string
  canWatch?: boolean
  onWatch?: (tableId: string) => void
  watchingMatchId?: string | null
  featured?: boolean
  tree?: boolean
}

export function matchStatusText(match: MatchSummary): string {
  if (match.live) {
    const number = match.games.findIndex((game) => game.live) + 1
    return match.liveDuration
      ? t('lobby', 'trn_b_game_live_time', { number, duration: match.liveDuration })
      : t('lobby', 'trn_b_game_live', { number })
  }
  const score = `${match.wins[0]}–${match.wins[1]}`
  return match.finished ? t('lobby', 'trn_b_match_finished', { score }) : t('lobby', 'trn_b_match_score', { score })
}

type Translate = (ns: 'lobby', key: string, params?: Record<string, string | number>) => string

function gameLabel(translate: Translate, game: MatchGameSummary, index: number, players: MatchSummary['players']): string {
  const number = index + 1
  if (game.live) return translate('lobby', 'trn_c_game_live', { number })
  if (game.winner === 'draw') return translate('lobby', 'trn_c_game_draw', { number })
  if ((game.winner === 0 || game.winner === 1) && players) {
    return translate('lobby', 'trn_c_game_won', { number, player: players[game.winner] })
  }
  return translate('lobby', 'trn_c_game_done', { number })
}

function gameCue(game: MatchGameSummary, index: number, players: MatchSummary['players']): string {
  const number = String(index + 1)
  if (game.live) return `${number} …`
  if (game.winner === 'draw') return `${number} =`
  if ((game.winner === 0 || game.winner === 1) && players) return `${number} ${initialOf(players[game.winner])}`
  return number
}

function GameMarks({ match, translate }: { match: MatchSummary; translate: Translate }) {
  if (match.games.length === 0) return null
  return (
    <ol className="trn-games" aria-label={translate('lobby', 'trn_b_game_progress')}>
      {match.games.map((game, index) => {
        const label = gameLabel(translate, game, index, match.players)
        return (
          <li
            key={index}
            className={`trn-game ${game.live ? 'is-live' : 'is-done'}`}
            title={label}
            data-testid="bracket-game-mark"
            data-state={game.live ? 'live' : 'done'}
          >
            <span aria-hidden="true">{gameCue(game, index, match.players)}</span>
            <span className="trn-sr">{label}</span>
          </li>
        )
      })}
    </ol>
  )
}

export default function TournamentMatchCard({ match, viewer, canWatch = false, onWatch, watchingMatchId, featured = false, tree = false }: TournamentMatchCardProps) {
  const { t: translate } = useTranslation()
  const tableId = match.tableId
  const watchable = canWatch && !featured && !!onWatch && match.live && !!match.liveGameId && !!tableId
  const classes = [
    'trn-match',
    match.live ? 'is-live' : '',
    match.finished ? 'is-finished' : '',
    featured ? 'is-featured' : '',
    tree ? 'is-tree' : '',
  ].filter(Boolean).join(' ')
  return (
    <article className={classes} data-testid="bracket-match" data-live={match.live ? 'true' : 'false'}>
      {match.players ? (
        <ul className="trn-match-players">
          {match.players.map((name, side) => {
            const won = match.winner === side
            const out = match.finished && match.winner !== null && !won
            const rowClass = ['trn-match-row', won ? 'is-winner' : '', out ? 'is-out' : '', viewer === name ? 'is-me' : ''].filter(Boolean).join(' ')
            return (
              <li key={side} className={rowClass} data-testid="bracket-match-player" data-winner={won ? 'true' : 'false'}>
                <span className="trn-match-name">{name}</span>
                {won && (
                  <span className="trn-winner-cue">
                    <Icon name="check" size={12} />
                    <span className="trn-sr">{translate('lobby', 'trn_c_winner')}</span>
                  </span>
                )}
                {viewer === name && <Chip tone="brand" size="xs" data-testid="bracket-you">{translate('lobby', 'trn_b_you')}</Chip>}
                <span className="trn-match-wins" data-testid="bracket-match-wins">{match.wins[side]}</span>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="trn-match-raw" data-testid="bracket-match-raw">{match.rawPlayers || '—'}</div>
      )}
      <GameMarks match={match} translate={translate} />
      <div className="trn-match-status" data-testid="bracket-match-status">{matchStatusText(match)}</div>
      {watchable && tableId && (
        <Button
          variant="soft"
          size="md"
          className="trn-watch"
          data-testid="bracket-watch"
          data-table={tableId}
          aria-label={translate('lobby', 'trn_b_watch_aria', { players: match.rawPlayers })}
          disabled={watchingMatchId === tableId}
          onClick={() => onWatch?.(tableId)}
        >
          <Icon name="eye" size={14} />
          <span>{translate('lobby', 'trn_b_watch')}</span>
        </Button>
      )}
    </article>
  )
}
