import { useTranslation } from '../../i18n'
import ChipButton from '../../ui/ChipButton'
import Icon from '../../ui/Icon'
import { TIME_LIMIT_OPTIONS, BUFFER_TIME_OPTIONS, getTimeLimitLabel, getBufferTimeLabel } from './constants'
import type { CreateTableForm } from './useCreateTableForm'
import Field from '../../ui/Field'
import Select from '../../ui/Select'
import CustomOptions from './CustomOptions'

export function TimeLimitField({ form }: { form: CreateTableForm }) {
  const { t } = useTranslation()
  return (
    <Field label={t('lobby','create_field_timing_limit')}>
      <Select
        value={form.timeLimit}
        onChange={form.setTimeLimit}
        options={TIME_LIMIT_OPTIONS.map((opt) => ({ value: opt.value, label: getTimeLimitLabel(opt, t) }))}
      />
    </Field>
  )
}

export function BufferTimeField({ form }: { form: CreateTableForm }) {
  const { t } = useTranslation()
  return (
    <Field label={t('lobby','create_field_buffer_time')}>
      <Select
        value={form.bufferTime}
        onChange={form.setBufferTime}
        options={BUFFER_TIME_OPTIONS.map((opt) => ({ value: opt.value, label: getBufferTimeLabel(opt, t) }))}
      />
    </Field>
  )
}

export function FreeMulligansField({ form }: { form: CreateTableForm }) {
  const { t } = useTranslation()
  return (
    <Field group label={<>{t('lobby','create_field_free_mulligans')} {form.recommendedMulligans > 0 && <em className="create-field-note">{t('lobby','create_mulligan_recommended_commander')}</em>}</>}>
      <div className="chip-row">
        {[0, 1, 2, 3, 4, 5].map((m) => (
          <ChipButton
            pill
            active={form.freeMulligans === m}
            key={m}
            onClick={() => form.setFreeMulligans(m)}
          >
            {m}
          </ChipButton>
        ))}
      </div>
    </Field>
  )
}

export function RangeAttackBox({ form }: { form: CreateTableForm }) {
  const { t } = useTranslation()
  return (
    <div className="create-multiplayer-box">
      <span className="multiplayer-box-title"><Icon name="crown" size={13} /> {t('lobby','create_tab_multi')}</span>
      <div className="create-grid-2col">
        <Field label={t('lobby','create_field_attack_option')}>
          <Select
            value={form.attackOption}
            onChange={form.setAttackOption}
            options={[
              { value: 'LEFT', label: t('lobby','create_option_attack_left') },
              { value: 'RIGHT', label: t('lobby','create_option_attack_right') },
              { value: 'MULTIPLE', label: t('lobby','create_option_attack_multiple') },
            ]}
          />
        </Field>
        <Field label={t('lobby','create_field_range')}>
          <Select
            value={form.range}
            onChange={form.setRange}
            options={[
              { value: 'ALL', label: t('lobby','create_option_range_all') },
              { value: 'ONE', label: t('lobby','create_option_range_one') },
              { value: 'TWO', label: t('lobby','create_option_range_two') },
            ]}
          />
        </Field>
      </div>
    </div>
  )
}

export default function TimingTab({ form }: { form: CreateTableForm }) {
  const { t } = useTranslation()
  return (
    <div className="create-tab-content">
      <div className="create-grid-2col">
        <TimeLimitField form={form} />
        <BufferTimeField form={form} />
      </div>

      <FreeMulligansField form={form} />

      <CustomOptions form={form} />

      {form.showRangeAttack && <RangeAttackBox form={form} />}
      {!form.showRangeAttack && (
        <div className="wizard-hint-box"><Icon name="info" size={13} /> {t('lobby','create_hint_range_attack')}</div>
      )}
    </div>
  )
}
