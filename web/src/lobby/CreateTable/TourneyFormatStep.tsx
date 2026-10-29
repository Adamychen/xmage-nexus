import type { KeyboardEvent } from 'react'
import ChipButton from '../../ui/ChipButton'
import Field from '../../ui/Field'
import Icon, { type IconName } from '../../ui/Icon'
import { useTranslation } from '../../i18n'
import {
  VARIANTS_BY_MODALITY,
  SWISS_ROUNDS_MAX,
  SWISS_ROUNDS_MIN,
  choiceDisabledReason,
  composeTournamentType,
  eliminationRoundCount,
  recommendedSwissRounds,
  type Modality,
  type Pairing,
  type PackVariant,
  type TournamentChoice,
} from '../tournament/tournamentType'
import { radioNavIndex } from './radioNav'
import { CompatibilityHint, DeckTypeField } from './TypeFields'
import TourneyPoolFields from './TourneyPoolFields'
import TourneySeatCount from './TourneySeatCount'
import {
  MODALITY_DESC_KEY,
  MODALITY_KEY,
  MODALITY_ORDER,
  PACK_KEY,
  PAIRING_DESC_KEY,
  PAIRING_KEY,
  PAIRING_ORDER,
  choiceOf,
  choiceWithModality,
  eliminationRoundLabels,
} from './tourneyFormat'
import type { CreateTableForm } from './types'

const MODALITY_ICON: Record<Modality, IconName> = {
  draft: 'layers',
  sealed: 'package',
  jumpstart: 'sparkles',
  constructed: 'shield',
}

const PAIRING_ICON: Record<Pairing, IconName> = {
  swiss: 'grid',
  elimination: 'swords',
}

interface RadioOption<T extends string> {
  id: T
  title: string
  desc?: string
  icon?: IconName
  reason: string | null
}

function RadioOptions<T extends string>({ label, options, value, onSelect, variant }: {
  label: string
  options: RadioOption<T>[]
  value: T
  onSelect: (id: T) => void
  variant: 'card' | 'chip'
}) {
  const focusId = options.some((o) => o.id === value) ? value : options[0]?.id
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const nodes = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]'))
    const next = radioNavIndex(e.key, nodes.indexOf(e.target as HTMLElement), nodes.length)
    if (next === null) return
    e.preventDefault()
    nodes[next].focus()
    if (!options[next].reason) onSelect(options[next].id)
  }
  return (
    <Field group label={label}>
      <div className={`trn-options trn-options--${variant}`} role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
        {options.map((option) => {
          const selected = option.id === value
          const disabled = option.reason !== null
          const cls = ['trn-option', selected ? 'active' : '', disabled ? 'is-unlisted' : ''].filter(Boolean).join(' ')
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-disabled={disabled || undefined}
              title={option.reason ?? undefined}
              tabIndex={option.id === focusId ? 0 : -1}
              className={cls}
              onClick={() => { if (!disabled) onSelect(option.id) }}
            >
              {option.icon && <span className="trn-option-icon"><Icon name={option.icon} size={variant === 'card' ? 18 : 12} /></span>}
              <span className="trn-option-text">
                <span className="trn-option-title">{option.title}</span>
                {option.desc && <span className="trn-option-desc">{option.desc}</span>}
              </span>
            </button>
          )
        })}
      </div>
    </Field>
  )
}

/** The Format step: name and presets, the modality × pairing × packs choice that names the server type, the pool, the seats and the rounds. */
export default function TourneyFormatStep({ form }: { form: CreateTableForm }) {
  const { t } = useTranslation()
  const choice = choiceOf(form.tournamentType)
  const serverName = composeTournamentType(choice)
  const limited = choice.modality !== 'constructed'
  const reasonFor = (candidate: TournamentChoice): string | null => (
    choiceDisabledReason(candidate, form.tournamentTypes) ? t('lobby', 'trn_not_listed') : null
  )

  const modalityOptions: RadioOption<Modality>[] = MODALITY_ORDER.map((modality) => ({
    id: modality,
    title: t('lobby', MODALITY_KEY[modality]),
    desc: t('lobby', MODALITY_DESC_KEY[modality]),
    icon: MODALITY_ICON[modality],
    reason: reasonFor(choiceWithModality(choice, modality)),
  }))
  const pairingOptions: RadioOption<Pairing>[] = PAIRING_ORDER.map((pairing) => ({
    id: pairing,
    title: t('lobby', PAIRING_KEY[pairing]),
    desc: t('lobby', PAIRING_DESC_KEY[pairing]),
    icon: PAIRING_ICON[pairing],
    reason: reasonFor({ ...choice, pairing }),
  }))
  const packOptions: RadioOption<PackVariant>[] = VARIANTS_BY_MODALITY[choice.modality].map((variant) => ({
    id: variant,
    title: t('lobby', PACK_KEY[variant]),
    reason: reasonFor({ ...choice, variant }),
  }))

  const selectChoice = (next: TournamentChoice) => {
    if (!choiceDisabledReason(next, form.tournamentTypes)) form.setTournamentChoice(next)
  }

  const swiss = choice.pairing === 'swiss'
  const recommended = recommendedSwissRounds(form.numPlayers)
  const rounds = Array.from({ length: SWISS_ROUNDS_MAX - SWISS_ROUNDS_MIN + 1 }, (_, i) => i + SWISS_ROUNDS_MIN)

  return (
    <div className="create-tab-content trn-format">
      <div className="trn-name-row">
        <Field label={t('lobby', 'create_field_table_name')} className="trn-name-field">
          <input
            value={form.name}
            onChange={(e) => form.setName(e.target.value)}
            maxLength={64}
            placeholder={t('lobby', 'placeholder_table_name')}
          />
        </Field>
        <div className="trn-presets" role="group" aria-label={t('lobby', 'create_presets_title')}>
          <ChipButton size="sm" onClick={() => form.applyPreset('draft_8p')}>
            {t('lobby', 'create_preset_draft_mh3')}
          </ChipButton>
          <ChipButton size="sm" onClick={() => form.applyPreset('modern_swiss_8p')}>
            {t('lobby', 'create_preset_modern_swiss')}
          </ChipButton>
        </div>
      </div>

      <RadioOptions<Modality>
        label={t('lobby', 'trn_modality_label')}
        options={modalityOptions}
        value={choice.modality}
        variant="card"
        onSelect={(modality) => selectChoice(choiceWithModality(choice, modality))}
      />

      <RadioOptions<Pairing>
        label={t('lobby', 'trn_pairing_label')}
        options={pairingOptions}
        value={choice.pairing}
        variant="card"
        onSelect={(pairing) => selectChoice({ ...choice, pairing })}
      />

      {limited && (
        <RadioOptions<PackVariant>
          label={t('lobby', 'trn_packs_label')}
          options={packOptions}
          value={choice.variant}
          variant="chip"
          onSelect={(variant) => selectChoice({ ...choice, variant })}
        />
      )}

      <p className="trn-server-type">
        {t('lobby', 'trn_server_type')} · <span className="trn-server-name">{serverName}</span>
      </p>

      {limited && <TourneyPoolFields form={form} choice={choice} />}
      {!limited && (
        <>
          <div className="format-fields format-fields--stack">
            <DeckTypeField form={form} />
          </div>
          <CompatibilityHint form={form} />
        </>
      )}

      <TourneySeatCount form={form} />

      {swiss ? (
        <Field group label={t('lobby', 'trn_rounds_label')} hint={t('lobby', 'trn_rounds_hint')}>
          <div className="chip-row">
            {rounds.map((n) => {
              const isRecommended = n === recommended
              const label = isRecommended
                ? t('lobby', 'trn_rounds_recommended', { count: n })
                : t('lobby', 'trn_rounds_option', { count: n })
              return (
                <ChipButton
                  key={n}
                  pill
                  active={form.numberRounds === n}
                  aria-label={label}
                  title={label}
                  onClick={() => form.setNumberRounds(n)}
                >
                  {n}
                  {isRecommended && <Icon name="star" size={11} />}
                </ChipButton>
              )
            })}
          </div>
        </Field>
      ) : (
        <div className="wizard-hint-box trn-elim-rounds">
          {t('lobby', 'trn_elim_summary', { count: eliminationRoundCount(form.numPlayers), path: eliminationRoundLabels(form.numPlayers, t) })}
        </div>
      )}
    </div>
  )
}
