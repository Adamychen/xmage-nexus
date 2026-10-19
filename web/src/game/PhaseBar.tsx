import { useTranslation } from '../i18n'
import { STEPS, STEP_GROUPS, activeStepIndex, isDamageStep, usePhaseStopToggles } from './phaseSteps'
import { useChangeFlag } from './useChangeFlag'
import './PhaseBar.css'

export function PhaseName({ step }: { step: string }) {
  const { t } = useTranslation()
  const def = STEPS.find((s) => s.key === step)
  if (isDamageStep(step)) {
    return (
      <span className="phase-name" data-testid="phase-name" aria-live="polite" key={step}>
        {t('game', 'combat_damage_title')}
      </span>
    )
  }
  if (!def) return null
  return (
    <span className="phase-name" data-testid="phase-name" aria-live="polite" key={def.key}>
      {t('game', def.nameKey)}
    </span>
  )
}

export default function PhaseBar({ step }: { step: string }) {
  const { t } = useTranslation()
  const activeIdx = activeStepIndex(step)
  const { phaseStops, toggleStop, toggleOpponentStop } = usePhaseStopToggles()
  const [wiping, clearWipe] = useChangeFlag(step)

  return (
    <div className="phase-bar" role="navigation" aria-label={t('game', 'phase')}>
      {STEP_GROUPS.map((g, gi) => {
        const groupSteps = STEPS.map((s, i) => ({ ...s, idx: i })).filter((s) => s.group === g)
        return (
          <span key={g} className="phase-group">
            {gi > 0 && <span className="phase-sep" aria-hidden="true">|</span>}
            {groupSteps.map((s) => {
              let cls = 'phase-badge'
              if (s.idx < activeIdx) cls += ' past'
              else if (s.idx === activeIdx) {
                cls += ' active'
                if (wiping) cls += ' phase-wipe'
              }

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
                  onAnimationEnd={s.idx === activeIdx && wiping ? clearWipe : undefined}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    toggleOpponentStop(s.stopKey)
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
