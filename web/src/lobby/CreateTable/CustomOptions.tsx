import { useTranslation } from '../../i18n'
import Checkbox from '../../ui/Checkbox'
import ChipButton from '../../ui/ChipButton'
import Field from '../../ui/Field'
import Icon from '../../ui/Icon'
import type { KeyboardEvent, ReactNode } from 'react'
import Collapsible from './Collapsible'
import { radioNavIndex } from './radioNav'
import type { CreateTableForm } from './useCreateTableForm'
import './CustomOptions.css'

export default function CustomOptions({ form }: { form: CreateTableForm }) {
  const { t } = useTranslation()
  const customized = form.mulliganType !== 'GAME_DEFAULT' || form.customStartLifeEnabled || form.customStartHandSizeEnabled || form.planeChase
  const customSummary = [
    form.mulliganType !== 'GAME_DEFAULT' ? 'Mulligan' : null,
    form.customStartLifeEnabled ? t('lobby','create_custom_life_tag',{life:form.customStartLife}) : null,
    form.customStartHandSizeEnabled ? t('lobby','create_custom_hand_tag',{hand:form.customStartHandSize}) : null,
    form.planeChase ? 'Planechase' : null,
  ].filter(Boolean).join(', ')

  const mulliganOptions = [
    { value: 'GAME_DEFAULT', label: t('lobby','create_mulligan_format_default') },
    { value: 'LONDON', label: 'London' },
    { value: 'VANCOUVER', label: 'Vancouver' },
    { value: 'PARIS', label: 'Paris' },
    { value: 'SMOOTHED_LONDON', label: 'Smoothed London' },
    { value: 'CANADIAN_HIGHLANDER', label: 'Canadian Highlander' },
  ]

  const onMulliganKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const chips = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]'))
    const next = radioNavIndex(e.key, chips.indexOf(e.target as HTMLElement), chips.length)
    if (next === null) return
    e.preventDefault()
    form.setMulliganType(mulliganOptions[next].value)
    chips[next].focus()
  }

  return (
    <Collapsible
      title={<><Icon name="dice" size={13} /> {t('lobby','create_custom_options')}</>}
      summary={customized ? customSummary : undefined}
      defaultOpen={customized}
    >
      <div className="custom-options">
        <Field group label={t('lobby','create_field_mulligan_type')}>
          <div className="mulligan-options" role="radiogroup" aria-label={t('lobby','create_field_mulligan_type')} onKeyDown={onMulliganKeyDown}>
            {mulliganOptions.map((opt) => {
              const selected = form.mulliganType === opt.value
              return (
                <ChipButton
                  key={opt.value}
                  pill
                  role="radio"
                  aria-checked={selected}
                  active={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => form.setMulliganType(opt.value)}
                >
                  {opt.label}
                </ChipButton>
              )
            })}
          </div>
        </Field>

        <div className="custom-options-grid">
          <NumberOption
            label={t('lobby','create_field_custom_life')}
            enabled={form.customStartLifeEnabled}
            onToggle={form.setCustomStartLifeEnabled}
            value={form.customStartLife}
            min={1}
            max={100}
            fallback={20}
            onChange={form.setCustomStartLife}
          />
          <NumberOption
            label={t('lobby','create_field_custom_hand')}
            enabled={form.customStartHandSizeEnabled}
            onToggle={form.setCustomStartHandSizeEnabled}
            value={form.customStartHandSize}
            min={0}
            max={20}
            fallback={7}
            onChange={form.setCustomStartHandSize}
          />
        </div>

        <Checkbox
          card
          checked={form.planeChase}
          onChange={form.setPlaneChase}
          icon="map"
          label="Planechase"
          description={t('lobby','create_planechase_desc')}
        />
      </div>
    </Collapsible>
  )
}

function NumberOption({
  label,
  enabled,
  onToggle,
  value,
  min,
  max,
  fallback,
  onChange,
}: {
  label: ReactNode
  enabled: boolean
  onToggle: (on: boolean) => void
  value: number
  min: number
  max: number
  fallback: number
  onChange: (value: number) => void
}) {
  return (
    <div className={`custom-number ${enabled ? 'is-on' : ''}`}>
      <Checkbox checked={enabled} onChange={onToggle} label={label} />
      <input
        type="number"
        inputMode="numeric"
        className="custom-number-input"
        aria-label={typeof label === 'string' ? label : undefined}
        min={min}
        max={max}
        value={value}
        disabled={!enabled}
        onChange={(e) => {
          const parsed = parseInt(e.target.value, 10)
          onChange(Math.min(max, Math.max(min, Number.isNaN(parsed) ? fallback : parsed)))
        }}
      />
    </div>
  )
}
