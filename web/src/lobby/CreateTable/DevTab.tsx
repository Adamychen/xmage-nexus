import { useTranslation } from '../../i18n'
import Icon from '../../ui/Icon'
import type { CreateTableForm } from './useCreateTableForm'

export default function DevTab({ form }: { form: CreateTableForm }) {
  const { t } = useTranslation()
  return (
    <div className="create-tab-content">
      <div className="wizard-step-heading">
        <h3><Icon name="settings" size={15} /> Dev / Test</h3>
        <p>Solo visible en desarrollo. Opciones de test del motor.</p>
      </div>
      <div className="dev-options-notice">
        <span><Icon name="alert" size={12} /> Solo para pruebas locales — no afecta a beta.</span>
      </div>

      <div className="dev-demo-box">
        <h4>Demo IA vs IA</h4>
        <p>Crea una mesa SIM vs SIM y arranca la partida automáticamente para espectar.</p>
        <button
          type="button"
          className="primary dev-demo-btn"
          onClick={() => void form.runDemoTable()}
          disabled={form.busy}
        >
          <Icon name="play" size={13} /> {t('lobby','watch_btn')} ({t('lobby','ai')} vs {t('lobby','ai')})
        </button>
      </div>

      <label className="toggle-label-row">
        <input
          type="checkbox"
          checked={form.skipInitShuffling}
          onChange={(e) => form.setSkipInitShuffling(e.target.checked)}
        />
        <div className="toggle-text-block">
          <span className="toggle-title"><Icon name="layers" size={12} /> {t('lobby','create_toggle_skip_shuffle')}</span>
          <span className="toggle-desc">No barajar (útil para tests deterministas).</span>
        </div>
      </label>

      <label className="toggle-label-row">
        <input
          type="checkbox"
          checked={form.skipStartingPlayerChoice}
          onChange={(e) => form.setSkipStartingPlayerChoice(e.target.checked)}
        />
        <div className="toggle-text-block">
          <span className="toggle-title"><Icon name="dice" size={12} /> {t('lobby','create_toggle_skip_starting')}</span>
          <span className="toggle-desc">Salta la elección de quién empieza.</span>
        </div>
      </label>
    </div>
  )
}
