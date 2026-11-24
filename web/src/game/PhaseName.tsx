import { useTranslation } from '../i18n'
import { STEPS, isDamageStep } from './phaseSteps'
import './PhaseName.css'

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
