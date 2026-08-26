import type { TournamentPlayerView } from '../net/types'

interface Props {
  players: TournamentPlayerView[]
  sortedPlayers?: TournamentPlayerView[]
}

export default function TournamentStandings({ players, sortedPlayers }: Props) {
  const list = sortedPlayers ?? [...players].sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
  if (list.length === 0) {
    return <div className="standings-empty" data-testid="standings-empty">Sin jugadores inscritos</div>
  }
  return (
    <div className="tournament-standings-wrap" data-testid="tournament-standings">
      <table className="tournament-standings-table" data-testid="standings-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Jugador</th>
            <th>Pts</th>
            <th>Estado</th>
            <th>Resultados</th>
            <th>Historial</th>
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
                {p.quit && <span className="standings-quit-badge" data-testid="standings-quit">Abandonó</span>}
              </td>
              <td className="standings-points" data-testid="standings-points">{p.points}</td>
              <td className="standings-state" data-testid="standings-state">{p.state}</td>
              <td className="standings-results" title={p.results ?? ''}>{p.results ?? '—'}</td>
              <td className="standings-history" title={p.history ?? ''}>{p.history ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
