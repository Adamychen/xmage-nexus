import { useState, useEffect } from 'react'
import { useStore } from '../state/store'
import TournamentBracket from '../lobby/TournamentBracket'
import { watchTournamentMatch } from '../lobby/useTournamentBracket'
import * as cmds from '../net/commands'
import Icon from '../ui/Icon'
import { useTranslation } from '../i18n'
import './TournamentPanel.css'

export default function TournamentPanel() {
  const { t } = useTranslation()
  const tournament = useStore((s) => s.tournament)
  const [expanded, setExpanded] = useState(true)
  const [quitting, setQuitting] = useState(false)
  const [watchingMatchId, setWatchingMatchId] = useState<string | null>(null)

  useEffect(() => {
    if (tournament) setExpanded(true)
  }, [tournament?.tournamentId])

  if (!tournament) return null

  const view = tournament.view
  const tid = tournament.tournamentId

  if (!expanded) {
    return (
      <button
        type="button"
        className="tournament-panel-mini"
        onClick={() => setExpanded(true)}
        data-testid="tournament-panel-mini"
        title={t('game', 'tournament_view_bracket_tooltip')}
      >
        <Icon name="trophy" size={13} /> {view.tournamentName} — {view.tournamentState} · {view.players.length} {t('lobby', view.players.length === 1 ? 'tournament_player_single' : 'tournament_player_plural')}
        <span className="tournament-mini-expand">{t('game', 'tournament_view_bracket')}</span>
      </button>
    )
  }

  const handleQuit = async () => {
    if (quitting) return
    if (!window.confirm(t('game', 'tournament_quit_confirm'))) return
    setQuitting(true)
    try {
      await cmds.quitTournament(tid)
    } finally {
      setQuitting(false)
    }
  }

  const handleWatchMatch = async (tableId: string) => {
    if (watchingMatchId) return
    setWatchingMatchId(tableId)
    try {
      await watchTournamentMatch(tableId)
    } finally {
      setWatchingMatchId(null)
    }
  }

  return (
    <div className="tournament-panel-backdrop" role="presentation" data-testid="tournament-panel">
      <section className="tournament-panel" role="dialog" aria-modal="true" aria-label={t('game', 'tournament_in_progress')}>
        <header className="tournament-panel-header">
          <div className="tournament-panel-title">
            <span className="tournament-panel-icon"><Icon name="trophy" size={15} /></span>
            <span>{t('game', 'tournament_in_progress')}</span>
            <span className="tournament-panel-name" data-testid="tournament-panel-name">{view.tournamentName}</span>
          </div>
          <div className="tournament-panel-actions">
            <button
              type="button"
              className="tournament-panel-collapse"
              onClick={() => setExpanded(false)}
              title={t('game', 'tournament_minimize')}
            >
              {t('game', 'tournament_minimize')}
            </button>
            <button
              type="button"
              className="tournament-panel-quit"
              onClick={() => void handleQuit()}
              disabled={quitting}
              data-testid="tournament-panel-quit"
            >
              {quitting ? t('game', 'tournament_leaving') : t('game', 'tournament_quit_short')}
            </button>
            <button
              type="button"
              className="tournament-panel-close"
              onClick={() => setExpanded(false)}
              aria-label={t('game', 'tournament_close')}
            >
              ✕
            </button>
          </div>
        </header>
        <div className="tournament-panel-scroll">
          <TournamentBracket
            view={view}
            tournamentId={tid}
            compact
            onWatchMatch={(id) => void handleWatchMatch(id)}
            watchingMatchId={watchingMatchId}
          />
        </div>
      </section>
    </div>
  )
}
