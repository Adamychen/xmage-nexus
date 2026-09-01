import { useEffect, useState, useMemo } from 'react'
import type { TournamentView, RoundView, TournamentGameView } from '../net/types'
import * as cmds from '../net/commands'
import './TournamentBracket.css'
import TournamentStandings from './TournamentStandings'
import { useTranslation } from '../i18n'

export interface TournamentBracketProps {
  view: TournamentView
  tournamentId?: string
  onClose?: () => void
  onQuit?: (tournamentId: string) => void
  compact?: boolean
}

function formatTimer(serverTime?: number, stepStartTime?: number | null): string {
  if (serverTime == null || stepStartTime == null) return ''
  const elapsedMs = serverTime - stepStartTime
  if (elapsedMs < 0) return '0:00'
  const totalSec = Math.floor(elapsedMs / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function TournamentBracketHeader({ view, tournamentId, onClose, onQuit }: TournamentBracketProps) {
  const { t } = useTranslation()
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (view.serverTime == null || view.stepStartTime == null) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [view.serverTime, view.stepStartTime])
  const liveElapsed = (() => {
    if (view.serverTime == null || view.stepStartTime == null) return ''
    const liveServer = (view.serverTime ?? 0) + tick * 1000
    return formatTimer(liveServer, view.stepStartTime)
  })()

  const timerLabel = view.stepStartTime != null && view.serverTime != null ? liveElapsed || formatTimer(view.serverTime, view.stepStartTime) : ''

  const handleQuit = async () => {
    const tid = tournamentId ?? view.tournamentName
    if (!tid) return
    if (onQuit) {
      onQuit(tid)
      return
    }
    try {
      await cmds.quitTournament(tid)
    } catch {}
  }

  return (
    <div className="tournament-bracket-header" data-testid="tournament-header">
      <div className="tournament-bracket-title-row">
        <div className="tournament-bracket-title">
          <h2 className="tournament-name" data-testid="tournament-name">{view.tournamentName}</h2>
          <span className="tournament-type" data-testid="tournament-type">{view.tournamentType}</span>
          <span className="tournament-state-badge" data-testid="tournament-state">{view.tournamentState}</span>
          {view.watchingAllowed ? (
            <span className="tournament-watching-badge" data-testid="tournament-watching">👁️ {t('lobby', 'tag_spectators')}</span>
          ) : (
            <span className="tournament-watching-badge off">🔒 {t('lobby', 'tag_private')}</span>
          )}
        </div>
        <div className="tournament-header-actions">
          {timerLabel && (
            <span className="tournament-timer" data-testid="tournament-timer" title={`serverTime ${view.serverTime} stepStart ${view.stepStartTime}`}>
              ⏱️ {timerLabel}
            </span>
          )}
          {view.constructionTime > 0 && (
            <span className="tournament-construction">🧱 {Math.floor(view.constructionTime / 60)}m {t('game', 'construct_title').toLowerCase()}</span>
          )}
          {onClose && (
            <button type="button" className="tournament-close-btn" onClick={onClose} aria-label={t('common', 'close')}>✕</button>
          )}
        </div>
      </div>
      {view.runningInfo && (
        <div className="tournament-running-info" data-testid="tournament-running-info">{view.runningInfo}</div>
      )}
      {(view.tournamentState.toLowerCase().includes('draft') || view.tournamentState.toLowerCase().includes('construct')) && (
        <div className="tournament-state-hint">{t('lobby', 'tournament_construction_hint')}</div>
      )}
      <div className="tournament-header-footer">
        <span className="tournament-meta" data-testid="tournament-meta">
          {view.rounds.length} {view.rounds.length === 1 ? t('lobby', 'tournament_round_single') : t('lobby', 'tournament_round_plural')} · {view.players.length} {view.players.length === 1 ? t('lobby', 'tournament_player_single') : t('lobby', 'tournament_player_plural')}
        </span>
        {tournamentId && (
          <button type="button" className="tournament-quit-btn" onClick={() => void handleQuit()} data-testid="tournament-quit">
            {t('lobby', 'tournament_quit')}
          </button>
        )}
      </div>
    </div>
  )
}

function BracketRound({ round, index, watchingAllowed }: { round: RoundView; index: number; watchingAllowed: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="bracket-round" data-testid="bracket-round" data-round={index}>
      <h4 className="bracket-round-title">{t('lobby', 'tournament_round_label', { number: index + 1 })}</h4>
      <div className="bracket-games">
        {round.games.length === 0 && <div className="bracket-empty">{t('lobby', 'bracket_empty')}</div>}
        {round.games.map((g: TournamentGameView, gi: number) => (
          <div key={`${g.tableId ?? g.matchId ?? gi}-${gi}`} className="bracket-game" data-testid="bracket-game">
            <div className="bracket-game-top">
              <span className="bracket-game-players" data-testid="bracket-game-players" title={g.players}>{g.players || '—'}</span>
              <span className={`bracket-game-state state-${String(g.state).toLowerCase()}`} data-testid="bracket-game-state">{g.state}</span>
            </div>
            {g.result && <div className="bracket-game-result" data-testid="bracket-game-result">{g.result}</div>}
            <div className="bracket-game-meta">
              {g.roundNum != null && <span className="bracket-round-num">#R{g.roundNum}</span>}
              {g.tableId && <span className="bracket-table-id" title={g.tableId}>{t('lobby', 'create_table_btn')} {g.tableId.slice(0, 6)}</span>}
              {watchingAllowed && g.gameId && <span className="bracket-watchable">👁️</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function TournamentBracket({ view, tournamentId, onClose, onQuit, compact }: TournamentBracketProps) {
  const { t } = useTranslation()
  const sortedPlayers = useMemo(() => {
    return [...view.players].sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
  }, [view.players])

  return (
    <div className={`tournament-bracket ${compact ? 'compact' : ''}`} data-testid="tournament-bracket">
      <TournamentBracketHeader view={view} tournamentId={tournamentId} onClose={onClose} onQuit={onQuit} />
      <div className="tournament-bracket-body">
        <section className="tournament-rounds-section" aria-label={t('lobby', 'bracket_title')}>
          <h3 className="tournament-section-title">{t('lobby', 'bracket_title')}</h3>
          {view.rounds.length === 0 ? (
            <div className="tournament-empty" data-testid="tournament-no-rounds">{t('lobby', 'bracket_no_rounds')}</div>
          ) : (
            <div className="bracket-columns" data-testid="bracket-columns">
              {view.rounds.map((r, idx) => (
                <BracketRound key={idx} round={r} index={idx} watchingAllowed={view.watchingAllowed} />
              ))}
            </div>
          )}
        </section>
        <section className="tournament-standings-section" aria-label={t('lobby', 'standings_title')}>
          <h3 className="tournament-section-title">{t('lobby', 'standings_title')}</h3>
          <TournamentStandings players={view.players} sortedPlayers={sortedPlayers} />
        </section>
      </div>
    </div>
  )
}

export { formatTimer }
