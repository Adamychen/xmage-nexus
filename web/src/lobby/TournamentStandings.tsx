import type { TournamentPlayerView } from '../net/types'
import Chip from '../ui/Chip'
import EmptyState from '../ui/EmptyState'
import { useTranslation } from '../i18n'
import { stateLabel } from './lobbyUtils'

interface Props {
  players: TournamentPlayerView[]
  sortedPlayers?: TournamentPlayerView[]
}

export default function TournamentStandings({ players, sortedPlayers }: Props) {
  const { t } = useTranslation()
  const list = sortedPlayers ?? [...players].sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
  if (list.length === 0) {
    return <EmptyState size="sm" data-testid="standings-empty">{t('lobby', 'standings_empty')}</EmptyState>
  }
  return (
    <div className="tournament-standings-wrap" data-testid="tournament-standings">
      <table className="tournament-standings-table" data-testid="standings-table">
        <thead>
          <tr>
            <th>#</th>
            <th>{t('lobby', 'leaderboard_col_player')}</th>
            <th>{t('lobby', 'leaderboard_col_points')}</th>
            <th>{t('lobby', 'leaderboard_col_status')}</th>
            <th>{t('lobby', 'leaderboard_col_results')}</th>
            <th>{t('lobby', 'leaderboard_col_history')}</th>
          </tr>
        </thead>
        <tbody>
          {list.map((p, idx) => (
            <tr
              key={`${p.name}-${idx}`}
              className={`standings-row ${p.quit ? 'is-quit' : ''}`}
              data-testid="standings-row"
              data-quit={p.quit ? 'true' : 'false'}
            >
              <td className="standings-rank">{idx + 1}</td>
              <td className="standings-name" data-testid="standings-name">
                <span className="standings-name-text">{p.name}</span>
                {p.flagName && <span className="standings-flag" title={p.flagName}>{p.flagName}</span>}
                {p.quit && <Chip tone="err" size="xs" data-testid="standings-quit">{t('lobby', 'standings_quit_badge')}</Chip>}
              </td>
              <td className="standings-points" data-testid="standings-points">{p.points}</td>
              <td className="standings-state" data-testid="standings-state">{stateLabel(t, p.state)}</td>
              <td className="standings-results" title={p.results ?? ''}>{p.results ?? '—'}</td>
              <td className="standings-history" title={p.history ?? ''}>{p.history ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
