import { useTranslation } from '../../i18n'
import ChipButton from '../../ui/ChipButton'
import Checkbox from '../../ui/Checkbox'
import Icon from '../../ui/Icon'
import { TIME_LIMIT_OPTIONS, BUFFER_TIME_OPTIONS, getTimeLimitLabel, getBufferTimeLabel } from './constants'
import type { CreateTableForm } from './useCreateTableForm'

export default function TimingTab({ form }: { form: CreateTableForm }) {
  const { t } = useTranslation()
  return (
    <div className="create-tab-content">
      <div className="wizard-step-heading">
        <h3><Icon name="clock" size={15} /> {t('lobby','create_tab_timing')}</h3>
        <p>{t('lobby','create_step_desc_timing')}</p>
      </div>
      <div className="create-grid-2col">
        <label>
          {t('lobby','create_field_timing_limit')}
          <select value={form.timeLimit} onChange={(e) => form.setTimeLimit(e.target.value)}>
            {TIME_LIMIT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{getTimeLimitLabel(opt, t)}</option>
            ))}
          </select>
        </label>

        <label>
          {t('lobby','create_field_buffer_time')}
          <select value={form.bufferTime} onChange={(e) => form.setBufferTime(e.target.value)}>
            {BUFFER_TIME_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{getBufferTimeLabel(opt, t)}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="field">
        <span>{t('lobby','create_field_free_mulligans')} {form.recommendedMulligans > 0 && <em style={{ textTransform: 'none', fontWeight: 400, color: '#9aa3c2' }}>{t('lobby','create_mulligan_recommended_commander')}</em>}</span>
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
      </div>

      <div className="create-restrictions-box" style={{ background: 'rgb(var(--brand-rgb) / 0.08)', borderColor: 'rgb(var(--brand-rgb) / 0.25)' }}>
        <span className="restrictions-box-title"><Icon name="dice" size={13} /> {t('lobby','create_custom_options')} {(form.mulliganType !== 'GAME_DEFAULT' || form.customStartLifeEnabled || form.customStartHandSizeEnabled || form.planeChase) ? `(${[form.mulliganType !== 'GAME_DEFAULT' ? 'Mulligan' : null, form.customStartLifeEnabled ? t('lobby','create_custom_life_tag',{life:form.customStartLife}) : null, form.customStartHandSizeEnabled ? t('lobby','create_custom_hand_tag',{hand:form.customStartHandSize}) : null, form.planeChase ? 'Planechase' : null].filter(Boolean).join(', ')})` : ''}</span>
        <label>
          {t('lobby','create_field_mulligan_type')}
          <select value={form.mulliganType} onChange={(e) => form.setMulliganType(e.target.value)}>
            <option value="GAME_DEFAULT">{t('lobby','create_mulligan_format_default')}</option>
            <option value="LONDON">London</option>
            <option value="VANCOUVER">Vancouver</option>
            <option value="PARIS">Paris</option>
            <option value="SMOOTHED_LONDON">Smoothed London</option>
            <option value="CANADIAN_HIGHLANDER">Canadian Highlander</option>
          </select>
        </label>
        <div className="create-grid-2col">
          <Checkbox
            card
            checked={form.customStartLifeEnabled}
            onChange={form.setCustomStartLifeEnabled}
            label={
              <>
                {t('lobby','create_field_custom_life')}
                <input type="number" min={1} max={100} value={form.customStartLife} onChange={(e) => form.setCustomStartLife(Math.min(100, Math.max(1, parseInt(e.target.value,10)||20)))} disabled={!form.customStartLifeEnabled} style={{ width: 72 }} />
              </>
            }
          />
          <Checkbox
            card
            checked={form.customStartHandSizeEnabled}
            onChange={form.setCustomStartHandSizeEnabled}
            label={
              <>
                {t('lobby','create_field_custom_hand')}
                <input type="number" min={0} max={20} value={form.customStartHandSize} onChange={(e) => form.setCustomStartHandSize(Math.min(20, Math.max(0, parseInt(e.target.value,10)||7)))} disabled={!form.customStartHandSizeEnabled} style={{ width: 72 }} />
              </>
            }
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

      {form.showRangeAttack && (
        <div className="create-multiplayer-box">
          <span className="multiplayer-box-title"><Icon name="crown" size={13} /> {t('lobby','create_tab_multi')}</span>
          <div className="create-grid-2col">
            <label>
              {t('lobby','create_field_attack_option')}
              <select value={form.attackOption} onChange={(e) => form.setAttackOption(e.target.value)}>
                <option value="LEFT">{t('lobby','create_option_attack_left')}</option>
                <option value="RIGHT">{t('lobby','create_option_attack_right')}</option>
                <option value="MULTIPLE">{t('lobby','create_option_attack_multiple')}</option>
              </select>
            </label>
            <label>
              {t('lobby','create_field_range')}
              <select value={form.range} onChange={(e) => form.setRange(e.target.value)}>
                <option value="ALL">{t('lobby','create_option_range_all')}</option>
                <option value="ONE">{t('lobby','create_option_range_one')}</option>
                <option value="TWO">{t('lobby','create_option_range_two')}</option>
              </select>
            </label>
          </div>
        </div>
      )}
      {!form.showRangeAttack && (
        <div className="wizard-hint-box">{t('lobby','create_hint_range_attack')}</div>
      )}
    </div>
  )
}
