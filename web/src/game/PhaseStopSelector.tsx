import { useCallback } from 'react'
import * as cmds from '../net/commands'
import { useStore } from '../state/store'
import { setState } from '../state/state'
import { useTranslation } from '../i18n'
import './PhaseStopSelector.css'

interface PhaseDef {
  key: string
  labelKey: string
  short: string
}

const PHASES: PhaseDef[] = [
  { key: 'upkeep', labelKey: 'step_upkeep', short: 'UP' },
  { key: 'draw', labelKey: 'step_draw', short: 'DR' },
  { key: 'main1', labelKey: 'step_main1', short: 'M1' },
  { key: 'beginCombat', labelKey: 'step_begin_combat', short: 'BC' },
  { key: 'endCombat', labelKey: 'step_end_combat', short: 'EC' },
  { key: 'main2', labelKey: 'step_main2', short: 'M2' },
  { key: 'endStep', labelKey: 'step_end_step', short: 'ET' },
]

const DEFAULT_PHASES: cmds.PhaseStops = {
  yourTurn: { upkeep: true, draw: true, main1: false, beginCombat: true, endCombat: false, main2: false, endStep: true },
  opponentTurn: { upkeep: true, draw: true, main1: false, beginCombat: true, endCombat: false, main2: false, endStep: true },
}

export function getPhaseStops(): cmds.PhaseStops {
  return DEFAULT_PHASES
}

export default function PhaseStopSelector() {
  const { t } = useTranslation()
  const phaseStops = useStore((s) => s.phaseStops)

  const toggle = useCallback((turn: 'yourTurn' | 'opponentTurn', key: string) => {
    const current = phaseStops[turn][key]
    const next = { ...phaseStops, [turn]: { ...phaseStops[turn], [key]: !current } }
    setState({ phaseStops: next })
    void cmds.updatePreferences(next)
  }, [phaseStops])

  return (
    <div className="phase-stop-selector">
      <span className="phase-stop-label">{t('game', 'phase_stops')}</span>
      <div className="phase-stop-row">
        <span className="phase-stop-turn-label">{t('game', 'phase_you')}</span>
        {PHASES.map((phase) => (
          <button
            key={`your-${phase.key}`}
            className={`phase-stop-btn ${phaseStops.yourTurn[phase.key] ? 'active' : ''}`}
            title={`${t('game', phase.labelKey as any)} (${t('game', 'your_turn')})`}
            onClick={() => toggle('yourTurn', phase.key)}
          >
            {phase.short}
          </button>
        ))}
      </div>
      <div className="phase-stop-row">
        <span className="phase-stop-turn-label">{t('game', 'phase_opp')}</span>
        {PHASES.map((phase) => (
          <button
            key={`opp-${phase.key}`}
            className={`phase-stop-btn ${phaseStops.opponentTurn[phase.key] ? 'active' : ''}`}
            title={`${t('game', phase.labelKey as any)} (${t('game', 'opponent_turn')})`}
            onClick={() => toggle('opponentTurn', phase.key)}
          >
            {phase.short}
          </button>
        ))}
      </div>
    </div>
  )
}
