import { useTranslation } from '../../i18n'
import Icon from '../../ui/Icon'
import { TIME_LIMIT_OPTIONS, BUFFER_TIME_OPTIONS } from './constants'
import type { CreateTableForm } from './useCreateTableForm'

export default function TimingTab({ form }: { form: CreateTableForm }) {
  const { t } = useTranslation()
  return (
    <div className="create-tab-content">
      <div className="wizard-step-heading">
        <h3><Icon name="clock" size={15} /> {t('lobby','create_tab_timing')}</h3>
        <p>Relojes, mulligans y reglas de mesa multijugador.</p>
      </div>
      <div className="create-grid-2col">
        <label>
          {t('lobby','create_field_timing_limit')}
          <select value={form.timeLimit} onChange={(e) => form.setTimeLimit(e.target.value)}>
            {TIME_LIMIT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>

        <label>
          Buffer de tiempo
          <select value={form.bufferTime} onChange={(e) => form.setBufferTime(e.target.value)}>
            {BUFFER_TIME_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="field">
        <span>{t('lobby','create_field_free_mulligans')} <em style={{ textTransform: 'none', fontWeight: 400, color: '#9aa3c2' }}>— recomendado 1 para Commander/FFA</em></span>
        <div className="chip-row">
          {[0, 1, 2, 3, 4, 5].map((m) => (
            <button
              key={m}
              type="button"
              className={`chip ${form.freeMulligans === m ? 'on' : ''}`}
              onClick={() => form.setFreeMulligans(m)}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="create-restrictions-box" style={{ background: 'rgba(124,92,255,0.08)', borderColor: 'rgba(124,92,255,0.25)' }}>
        <span className="restrictions-box-title"><Icon name="dice" size={13} /> Opciones Custom {(form.mulliganType !== 'GAME_DEFAULT' || form.customStartLifeEnabled || form.customStartHandSizeEnabled || form.planeChase) ? `(${[form.mulliganType !== 'GAME_DEFAULT' ? 'Mulligan' : null, form.customStartLifeEnabled ? 'Vida' : null, form.customStartHandSizeEnabled ? 'Mano' : null, form.planeChase ? 'Planechase' : null].filter(Boolean).join(', ')})` : ''}</span>
        <label>
          Tipo de Mulligan
          <select value={form.mulliganType} onChange={(e) => form.setMulliganType(e.target.value)}>
            <option value="GAME_DEFAULT">Por defecto del formato</option>
            <option value="LONDON">London</option>
            <option value="VANCOUVER">Vancouver</option>
            <option value="PARIS">Paris</option>
            <option value="SMOOTHED_LONDON">Smoothed London</option>
            <option value="CANADIAN_HIGHLANDER">Canadian Highlander</option>
          </select>
        </label>
        <div className="create-grid-2col">
          <label className="toggle-label-row" style={{ flexDirection: 'row' as const, alignItems: 'center' }}>
            <input type="checkbox" checked={form.customStartLifeEnabled} onChange={(e) => form.setCustomStartLifeEnabled(e.target.checked)} />
            <span style={{ fontSize: 11, textTransform: 'none', letterSpacing: 'normal', color: '#c4cae8' }}>Vida inicial custom</span>
            <input type="number" min={1} max={100} value={form.customStartLife} onChange={(e) => form.setCustomStartLife(Math.min(100, Math.max(1, parseInt(e.target.value,10)||20)))} disabled={!form.customStartLifeEnabled} style={{ width: 72, marginLeft: 8 }} />
          </label>
          <label className="toggle-label-row" style={{ flexDirection: 'row' as const, alignItems: 'center' }}>
            <input type="checkbox" checked={form.customStartHandSizeEnabled} onChange={(e) => form.setCustomStartHandSizeEnabled(e.target.checked)} />
            <span style={{ fontSize: 11, textTransform: 'none', letterSpacing: 'normal', color: '#c4cae8' }}>Mano inicial custom</span>
            <input type="number" min={0} max={20} value={form.customStartHandSize} onChange={(e) => form.setCustomStartHandSize(Math.min(20, Math.max(0, parseInt(e.target.value,10)||7)))} disabled={!form.customStartHandSizeEnabled} style={{ width: 72, marginLeft: 8 }} />
          </label>
        </div>
        <label className="toggle-label-row">
          <input type="checkbox" checked={form.planeChase} onChange={(e) => form.setPlaneChase(e.target.checked)} />
          <div className="toggle-text-block">
            <span className="toggle-title"><Icon name="map" size={12} /> Planechase</span>
            <span className="toggle-desc">Mazo planar compartido + dado de 9 caras (experimental).</span>
          </div>
        </label>
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
        <div className="wizard-hint-box">Las opciones de ataque y rango aparecen automáticamente al elegir un formato multijugador (Commander / Free For All).</div>
      )}
    </div>
  )
}
