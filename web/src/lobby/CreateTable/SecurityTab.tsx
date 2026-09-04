import { useTranslation } from '../../i18n'
import type { CreateTableForm } from './useCreateTableForm'

export default function SecurityTab({ form }: { form: CreateTableForm }) {
  const { t } = useTranslation()
  return (
    <div className="create-tab-content">
      <div className="wizard-step-heading">
        <h3>🛡️ {t('lobby','create_tab_restrictions')}</h3>
        <p>Privacidad y filtros de acceso a la mesa.</p>
      </div>
      <label>
        {t('lobby','create_field_password')}
        <div className="password-field-wrap">
          <input
            type={form.showPassword ? 'text' : 'password'}
            value={form.password}
            onChange={(e) => form.setPassword(e.target.value)}
            placeholder={t('lobby','placeholder_password')}
          />
          <button type="button" className="password-toggle-btn" onClick={() => form.setShowPassword(!form.showPassword)} title={form.showPassword ? 'Ocultar' : 'Mostrar'}>
            {form.showPassword ? '🙈' : '👁️'}
          </button>
        </div>
      </label>

      <div className="create-restrictions-box">
        <span className="restrictions-box-title">🛡️ {t('lobby','create_tab_restrictions')}</span>
        <div className="create-grid-2col">
          <label>
            {t('lobby','create_field_min_rating')}
            <input
              type="number"
              min={0}
              max={3000}
              step={50}
              value={form.minimumRating}
              onChange={(e) => form.setMinimumRating(Math.max(0, parseInt(e.target.value, 10) || 0))}
              placeholder={t('common','all')}
            />
            <span className="create-field-hint">
              {form.minimumRating > 0 ? `${t('lobby','create_field_min_rating')}: ≥ ${form.minimumRating}` : t('common','all')}
            </span>
          </label>

          <label>
            {t('lobby','create_field_quit_ratio')}
            <input
              type="number"
              min={0}
              max={100}
              step={5}
              value={form.quitRatio}
              onChange={(e) => form.setQuitRatio(Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)))}
              placeholder={t('common','all')}
            />
            <span className="create-field-hint">
              {form.quitRatio < 100 ? `${t('lobby','create_field_quit_ratio')}: ${form.quitRatio}%` : t('common','all')}
            </span>
          </label>
        </div>

        {form.isMultiplayerGame && (
          <div style={{ marginTop: 10 }}>
            <label>
              Potencia EDH (solo Commander, 0-100)
              <input
                type="number"
                min={0}
                max={100}
                step={5}
                value={form.edhPowerLevel}
                onChange={(e) => form.setEdhPowerLevel(Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                placeholder={t('common','all')}
              />
              <span className="create-field-hint">
                {form.edhPowerLevel < 100 ? `EDH Power: ${form.edhPowerLevel}` : t('common','all') + ' — sin límite'}
              </span>
            </label>
          </div>
        )}
      </div>

      <label className="toggle-label-row">
        <input
          type="checkbox"
          checked={form.spectatorsAllowed}
          onChange={(e) => form.setSpectatorsAllowed(e.target.checked)}
        />
        <div className="toggle-text-block">
          <span className="toggle-title">👁️ {t('lobby','create_field_spectators')}</span>
          <span className="toggle-desc">Permite que otros usuarios observen la partida en vivo.</span>
        </div>
      </label>

      <label className="toggle-label-row">
        <input
          type="checkbox"
          checked={form.rollbackTurnsAllowed}
          onChange={(e) => form.setRollbackTurnsAllowed(e.target.checked)}
        />
        <div className="toggle-text-block">
          <span className="toggle-title">⏪ {t('lobby','create_field_rollback')}</span>
          <span className="toggle-desc">Permite solicitar rebobinar la partida a un turno anterior.</span>
        </div>
      </label>
    </div>
  )
}
