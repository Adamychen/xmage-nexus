import { useCallback } from 'react'
import * as cmds from '../net/commands'
import { useStore } from '../state/store'
import { setState } from '../state/state'
import { useTranslation } from '../i18n'
import './PhaseBar.css'

interface StepDef {
  key: string
  label: string
  nameKey: any
  group: string
  stopKey?: string
}

const STEPS: StepDef[] = [
  { key: 'UPKEEP',            label: 'UP',  nameKey: 'step_upkeep',         group: 'b',  stopKey: 'upkeep' },
  { key: 'DRAW',              label: 'DR',  nameKey: 'step_draw',           group: 'b',  stopKey: 'draw' },
  { key: 'PRECOMBAT_MAIN',    label: 'M1',  nameKey: 'step_main1',          group: 'm1', stopKey: 'main1' },
  { key: 'BEGIN_COMBAT',      label: 'BC',  nameKey: 'step_begin_combat',   group: 'c',  stopKey: 'beginCombat' },
  { key: 'DECLARE_ATTACKERS', label: 'AT',  nameKey: 'step_attackers',      group: 'c' },
  { key: 'DECLARE_BLOCKERS',  label: 'BL',  nameKey: 'step_blockers',       group: 'c' },
  { key: 'END_COMBAT',        label: 'EC',  nameKey: 'step_end_combat',     group: 'c',  stopKey: 'endCombat' },
  { key: 'POSTCOMBAT_MAIN',   label: 'M2',  nameKey: 'step_main2',          group: 'm2', stopKey: 'main2' },
  { key: 'END_TURN',          label: 'ET',  nameKey: 'step_end_step',       group: 'e',  stopKey: 'endStep' },
  { key: 'CLEANUP',           label: 'CL',  nameKey: 'step_cleanup',        group: 'e' },
]

const GROUPS = ['b', 'm1', 'c', 'm2', 'e']

export default function PhaseBar({ step }: { step: string }) {
  const { t } = useTranslation()
  const currentIdx = STEPS.findIndex((s) => s.key === step)
  const activeIdx = currentIdx >= 0 ? currentIdx : 0
  const phaseStops = useStore((s) => s.phaseStops)

  const toggleStop = useCallback((stopKey?: string, e?: React.MouseEvent) => {
    if (!stopKey || !phaseStops) return
    e?.preventDefault()
    e?.stopPropagation()

    const currentYour = !!phaseStops.yourTurn?.[stopKey]
    const currentOpp = !!phaseStops.opponentTurn?.[stopKey]

    const nextYour = e?.shiftKey ? currentYour : !currentYour
    const nextOpp = e?.shiftKey ? !currentOpp : currentOpp

    const next = {
      yourTurn: { ...(phaseStops.yourTurn ?? {}), [stopKey]: nextYour },
      opponentTurn: { ...(phaseStops.opponentTurn ?? {}), [stopKey]: nextOpp },
    }
    setState({ phaseStops: next })
    void cmds.updatePreferences(next)
  }, [phaseStops])

  return (
    <div className="phase-bar" role="navigation" aria-label={t('game', 'phase')}>
      {GROUPS.map((g, gi) => {
        const groupSteps = STEPS.map((s, i) => ({ ...s, idx: i })).filter((s) => s.group === g)
        return (
          <span key={g} className="phase-group">
            {gi > 0 && <span className="phase-sep" aria-hidden="true">|</span>}
            {groupSteps.map((s) => {
              let cls = 'phase-badge'
              if (s.idx < activeIdx) cls += ' past'
              else if (s.idx === activeIdx) cls += ' active'

              const hasYourStop = s.stopKey ? !!phaseStops?.yourTurn?.[s.stopKey] : false
              const hasOppStop = s.stopKey ? !!phaseStops?.opponentTurn?.[s.stopKey] : false

              if (hasYourStop || hasOppStop) cls += ' has-stop'

              const stepFullName = t('game', s.nameKey)
              const onLabel = t('common', 'yes')
              const offLabel = t('common', 'no')

              return (
                <button
                  type="button"
                  key={s.key}
                  className={cls}
                  data-testid={`phase-bar-step-${s.key}`}
                  title={`${stepFullName}${s.stopKey ? ` (${t('game', 'you')}: ${hasYourStop ? onLabel : offLabel}, ${t('game', 'opponent')}: ${hasOppStop ? onLabel : offLabel})` : ''}`}
                  onClick={(e) => toggleStop(s.stopKey, e)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    if (s.stopKey) {
                      const cur = !!phaseStops?.opponentTurn?.[s.stopKey]
                      const next = {
                        ...phaseStops,
                        opponentTurn: { ...(phaseStops.opponentTurn ?? {}), [s.stopKey]: !cur },
                      }
                      setState({ phaseStops: next })
                      void cmds.updatePreferences(next)
                    }
                  }}
                >
                  {hasOppStop && <span className="stop-dot stop-dot-opp" title={t('game', 'opponent')} />}
                  <span className="phase-label">{s.label}</span>
                  {hasYourStop && <span className="stop-dot stop-dot-you" title={t('game', 'you')} />}
                </button>
              )
            })}
          </span>
        )
      })}
    </div>
  )
}
