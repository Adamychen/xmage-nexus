import { useCallback } from 'react'
import * as cmds from '../net/commands'
import type { PhaseStops } from '../net/commands'
import { useStore } from '../state/store'
import { getState, setState } from '../state/state'
import { useTranslation } from '../i18n'
import { PHASES, serverPhaseStops, togglePhaseStop } from './phaseStops'
import type { PhaseTurn } from './phaseStops'
import './PhaseStopSelector.css'

interface GridProps {
  value: PhaseStops
  onToggle: (turn: PhaseTurn, key: string) => void
  idPrefix: string
  /** Head the columns with each step's code and name (Settings, SET-8). */
  showStepNames?: boolean
}

export function PhaseStopGrid({ value, onToggle, idPrefix, showStepNames = false }: GridProps) {
  const { t } = useTranslation()
  const rows: Array<{ turn: PhaseTurn; turnKey: 'phase_you' | 'phase_opp'; titleKey: 'your_turn' | 'opponent_turn' }> = [
    { turn: 'yourTurn', turnKey: 'phase_you', titleKey: 'your_turn' },
    { turn: 'opponentTurn', turnKey: 'phase_opp', titleKey: 'opponent_turn' },
  ]
  return (
    <>
      {showStepNames && (
        <div className="phase-stop-row phase-stop-head" aria-hidden="true">
          <span className="phase-stop-turn-label" />
          {PHASES.map((phase) => (
            <span key={phase.key} className="phase-stop-head-cell">
              <span className="phase-stop-head-code">{phase.short}</span>
              <span className="phase-stop-head-name">{t('game', phase.labelKey)}</span>
            </span>
          ))}
        </div>
      )}
      {rows.map((row) => (
        <div className="phase-stop-row" key={row.turn}>
          <span className="phase-stop-turn-label">{t('game', row.turnKey)}</span>
          {PHASES.map((phase) => (
            <button
              key={`${row.turn}-${phase.key}`}
              type="button"
              className={`phase-stop-btn ${value[row.turn][phase.key] ? 'active' : ''}`}
              title={`${t('game', phase.labelKey)} (${t('game', row.titleKey)})`}
              data-testid={`${idPrefix}-stop-${row.turn === 'yourTurn' ? 'your' : 'opp'}-${phase.key}`}
              onClick={() => onToggle(row.turn, phase.key)}
            >
              {phase.short}
            </button>
          ))}
        </div>
      ))}
    </>
  )
}

export default function PhaseStopSelector() {
  const { t } = useTranslation()
  const phaseStops = useStore((s) => s.phaseStops)

  const toggle = useCallback((turn: PhaseTurn, key: string) => {
    const next = togglePhaseStop(phaseStops, turn, key)
    setState({ phaseStops: next })
    void cmds.updatePreferences(serverPhaseStops(getState().settings.smartStops, next))
  }, [phaseStops])

  return (
    <div className="phase-stop-selector" data-testid="phase-stop-selector">
      <span className="phase-stop-label">{t('game', 'phase_stops')}</span>
      <PhaseStopGrid value={phaseStops} onToggle={toggle} idPrefix="session" />
    </div>
  )
}
