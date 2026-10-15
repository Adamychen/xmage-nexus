import Button from '../ui/Button'
import { useTranslation } from '../i18n'
import OptionPreview, { type OptionPreviewKind } from './OptionPreview'

interface Props {
  kind: OptionPreviewKind
  label: string
  hint: string
  value: boolean
  onChange: (next: boolean) => void
}

/**
 * Off/on picker for a card-display option, drawn like the other Settings → Board
 * pickers: the same card tiles, each showing its own state's miniature.
 */
export default function OptionChoice({ kind, label, hint, value, onChange }: Props) {
  const { t } = useTranslation()
  return (
    <section className="option-choice" data-testid={`option-choice-${kind}`}>
      <h4 className="option-choice-title">{label}</h4>
      <p className="settings-hint">{hint}</p>
      <div className="settings-cards">
        {[false, true].map((state) => (
          <Button
            key={state ? 'on' : 'off'}
            variant="ghost"
            className={`settings-card ${value === state ? 'selected' : ''}`}
            onClick={() => onChange(state)}
            aria-pressed={value === state}
            data-testid={`option-choice-${kind}-${state ? 'on' : 'off'}`}
          >
            <OptionPreview kind={kind} on={state} />
            <span className="settings-card-label">{t('lobby', state ? 'option_choice_on' : 'option_choice_off')}</span>
            {value === state && <span className="settings-card-check">✓</span>}
          </Button>
        ))}
      </div>
    </section>
  )
}
