import { useTranslation } from '../../i18n'
import ChipButton from '../../ui/ChipButton'
import Icon from '../../ui/Icon'
import { TIME_LIMIT_OPTIONS, BUFFER_TIME_OPTIONS, getTimeLimitLabel, getBufferTimeLabel } from './constants'
import type { CreateTableForm } from './useCreateTableForm'
import Field from '../../ui/Field'
import CustomOptions from './CustomOptions'

export default function TimingTab({ form }: { form: CreateTableForm }) {
  const { t } = useTranslation()
  return (
    <div className="create-tab-content">
      <div className="create-grid-2col">
        <Field label={t('lobby','create_field_timing_limit')}>
          <select value={form.timeLimit} onChange={(e) => form.setTimeLimit(e.target.value)}>
            {TIME_LIMIT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{getTimeLimitLabel(opt, t)}</option>
            ))}
          </select>
        </Field>

        <Field label={t('lobby','create_field_buffer_time')}>
          <select value={form.bufferTime} onChange={(e) => form.setBufferTime(e.target.value)}>
            {BUFFER_TIME_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{getBufferTimeLabel(opt, t)}</option>
            ))}
          </select>
        </Field>
      </div>

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

      <CustomOptions form={form} />

      {form.showRangeAttack && (
        <div className="create-multiplayer-box">
          <span className="multiplayer-box-title"><Icon name="crown" size={13} /> {t('lobby','create_tab_multi')}</span>
          <div className="create-grid-2col">
            <Field label={t('lobby','create_field_attack_option')}>
              <select value={form.attackOption} onChange={(e) => form.setAttackOption(e.target.value)}>
                <option value="LEFT">{t('lobby','create_option_attack_left')}</option>
                <option value="RIGHT">{t('lobby','create_option_attack_right')}</option>
                <option value="MULTIPLE">{t('lobby','create_option_attack_multiple')}</option>
              </select>
            </Field>
            <Field label={t('lobby','create_field_range')}>
              <select value={form.range} onChange={(e) => form.setRange(e.target.value)}>
                <option value="ALL">{t('lobby','create_option_range_all')}</option>
                <option value="ONE">{t('lobby','create_option_range_one')}</option>
                <option value="TWO">{t('lobby','create_option_range_two')}</option>
              </select>
            </Field>
          </div>
        </div>
      )}
      {!form.showRangeAttack && (
        <div className="wizard-hint-box"><Icon name="info" size={13} /> {t('lobby','create_hint_range_attack')}</div>
      )}
    </div>
  )
}
