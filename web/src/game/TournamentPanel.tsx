import { useState, useEffect } from 'react'
import { useStore } from '../state/store'
import TournamentBracket from '../lobby/TournamentBracket'
import * as cmds from '../net/commands'
import './TournamentPanel.css'

export default function TournamentPanel() {
  const tournament = useStore((s) => s.tournament)
  const [expanded, setExpanded] = useState(true)
  const [quitting, setQuitting] = useState(false)

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
        title="Ver bracket del torneo"
      >
        🏆 {view.tournamentName} — {view.tournamentState} · {view.players.length} jugadores
        <span className="tournament-mini-expand">Ver bracket ▸</span>
      </button>
    )
  }

  const handleQuit = async () => {
    if (quitting) return
    setQuitting(true)
    try {
      await cmds.quitTournament(tid)
    } finally {
      setQuitting(false)
    }
  }

  return (
    <div className="tournament-panel-backdrop" role="presentation" data-testid="tournament-panel">
      <section className="tournament-panel" role="dialog" aria-modal="true" aria-label="Torneo">
        <header className="tournament-panel-header">
          <div className="tournament-panel-title">
            <span className="tournament-panel-icon">🏆</span>
            <span>Torneo en curso</span>
            <span className="tournament-panel-name" data-testid="tournament-panel-name">{view.tournamentName}</span>
          </div>
          <div className="tournament-panel-actions">
            <button
              type="button"
              className="tournament-panel-collapse"
              onClick={() => setExpanded(false)}
              title="Minimizar"
            >
              ─ Minimizar
            </button>
            <button
              type="button"
              className="tournament-panel-quit"
              onClick={() => void handleQuit()}
              disabled={quitting}
              data-testid="tournament-panel-quit"
            >
              {quitting ? 'Saliendo…' : 'Abandonar'}
            </button>
            <button
              type="button"
              className="tournament-panel-close"
              onClick={() => setExpanded(false)}
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
        </header>
        <div className="tournament-panel-scroll">
          <TournamentBracket view={view} tournamentId={tid} compact />
        </div>
      </section>
    </div>
  )
}
