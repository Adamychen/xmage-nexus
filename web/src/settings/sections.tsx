import { useSettings, setSetting } from '../state/store'
import { useTranslation } from '../i18n'
import { SLEEVES } from '../appearance/sleeves'
import { ZOOM_PRESETS, isZoomPreset, stepZoom, zoomPercent } from '../appearance/zoom'
import SoundFxControls from './SoundFxControls'
import Toggle from '../ui/Toggle'
import './SettingsModal.css'
import '../appearance/SleevePickerModal.css'

export const LAYOUTS: Array<{ id: 'standard' | 'pod' | 'arena'; labelKey: string; descKey: string }> = [
  { id: 'standard', labelKey: 'board_standard', descKey: 'board_standard_desc' },
  { id: 'pod', labelKey: 'board_pod', descKey: 'board_pod_desc' },
  { id: 'arena', labelKey: 'board_arena', descKey: 'board_arena_desc' },
]

export function LanguageSection() {
  const { t, lang, setLanguage, languages, cardLang, setCardLanguage, cardLanguages } = useTranslation()
  return (
    <div>
      <label className="settings-field" htmlFor="settings-ui-lang">
        <span className="settings-field-label">{t('common', 'language')}</span>
        <select
          id="settings-ui-lang"
          className="settings-select"
          value={lang}
          onChange={(e) => setLanguage(e.target.value as Parameters<typeof setLanguage>[0])}
          data-testid="settings-ui-lang"
        >
          {languages.map((l) => (
            <option key={l.code} value={l.code}>{l.name}</option>
          ))}
        </select>
      </label>
      <label className="settings-field" htmlFor="settings-card-lang">
        <span className="settings-field-label">{t('common', 'card_language')}</span>
        <select
          id="settings-card-lang"
          className="settings-select"
          value={cardLang}
          onChange={(e) => setCardLanguage(e.target.value)}
          data-testid="settings-card-lang"
        >
          {cardLanguages.map((cl) => (
            <option key={cl.code} value={cl.code}>{cl.name}</option>
          ))}
        </select>
      </label>
    </div>
  )
}

export function InterfaceSection() {
  const { t, lang } = useTranslation()
  const settings = useSettings()
  const stops = ZOOM_PRESETS.map((value) => ({ value, label: `${Math.round(value * 100)}%` }))
  const cjkLang = lang === 'ja' || lang === 'zhs'
  return (
    <div>
      <h3 className="settings-section-title">{t('lobby', 'ui_scale_title')}</h3>
      <p className="settings-hint">{t('lobby', 'ui_scale_hint')}</p>
      <div className="settings-stepper">
        <button
          type="button"
          className="settings-step"
          onClick={() => setSetting('uiScale', stepZoom(settings.uiScale, -1))}
          title={t('lobby', 'zoom_out')}
          aria-label={t('lobby', 'zoom_out')}
          data-testid="settings-zoom-minus"
        >
          −
        </button>
        <button
          type="button"
          className="settings-step-value"
          onClick={() => setSetting('uiScale', 1)}
          title={t('lobby', 'zoom_reset')}
          data-testid="settings-zoom-current"
        >
          {zoomPercent(settings.uiScale)}%
        </button>
        <button
          type="button"
          className="settings-step"
          onClick={() => setSetting('uiScale', stepZoom(settings.uiScale, 1))}
          title={t('lobby', 'zoom_in')}
          aria-label={t('lobby', 'zoom_in')}
          data-testid="settings-zoom-plus"
        >
          +
        </button>
      </div>
      <div className="settings-stops">
        {stops.map((o) => (
          <button
            key={o.value}
            type="button"
            className={`settings-stop ${isZoomPreset(settings.uiScale, o.value) ? 'selected' : ''}`}
            onClick={() => setSetting('uiScale', o.value)}
            data-testid={`settings-zoom-${String(o.value).replace('.', '-')}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <Toggle
        checked={settings.cjkBoost}
        onChange={(v) => setSetting('cjkBoost', v)}
        label={t('lobby', 'cjk_boost_label')}
        disabled={!cjkLang}
        title={cjkLang ? undefined : t('lobby', 'cjk_boost_only')}
      />
    </div>
  )
}

export function BoardSection() {
  const { t } = useTranslation()
  const settings = useSettings()
  return (
    <div>
      <h3 className="settings-section-title">{t('lobby', 'appearance_board_title')}</h3>
      <p className="settings-hint">{t('lobby', 'appearance_board_hint')}</p>
      <div className="settings-cards">
        {LAYOUTS.map((l) => (
          <button
            key={l.id}
            type="button"
            className={`settings-card ${settings.boardLayout === l.id ? 'selected' : ''}`}
            onClick={() => setSetting('boardLayout', l.id)}
            data-testid={`settings-layout-${l.id}`}
          >
            <span className="settings-card-label">{t('lobby', l.labelKey as 'board_standard')}</span>
            <span className="settings-card-desc">{t('lobby', l.descKey as 'board_standard_desc')}</span>
            {settings.boardLayout === l.id && <span className="settings-card-check">✓</span>}
          </button>
        ))}
      </div>
      <h3 className="settings-section-title">{t('lobby', 'sleeve_pick_title')}</h3>
      <p className="settings-hint">{t('lobby', 'sleeve_pick_subtitle')}</p>
      <div className="appearance-sleeve-grid">
        {SLEEVES.map((s) => (
          <button
            key={s.id}
            type="button"
            className="sleeve-item"
            onClick={() => setSetting('sleeveId', s.id)}
            data-testid={`settings-sleeve-${s.id}`}
            title={s.name}
          >
            <div className="sleeve-preview" style={s.kind === 'css' ? { background: s.css } : undefined}>
              {s.kind === 'css' ? (
                <span className="sleeve-preview-emblem" style={{ color: s.accent }}>{s.emblem}</span>
              ) : (
                <img src={s.imageUrl} alt={s.name} draggable={false} />
              )}
              {settings.sleeveId === s.id && <span className="sleeve-check">✓</span>}
            </div>
            <span className="sleeve-name">{s.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function SoundSection() {
  return (
    <div className="settings-sound-card" data-testid="settings-sound-card">
      <SoundFxControls />
    </div>
  )
}

export function GameplayQuickSection() {
  const { t } = useTranslation()
  const settings = useSettings()
  return (
    <div>
      <Toggle
        checked={settings.autoPass}
        onChange={(v) => setSetting('autoPass', v)}
        label={t('game', 'auto_pass')}
      />
      <Toggle
        checked={settings.autoKeepMulligan}
        onChange={(v) => setSetting('autoKeepMulligan', v)}
        label={t('game', 'auto_mulligan')}
      />
      <Toggle
        checked={settings.manaPayment.auto}
        onChange={() => setSetting('manaPayment', { ...settings.manaPayment, auto: !settings.manaPayment.auto })}
        label={t('game', 'mana_payment_auto')}
        title={t('game', 'mana_payment_auto_tip')}
      />
    </div>
  )
}
