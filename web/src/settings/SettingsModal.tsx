import { useState } from 'react'
import { useSettings, setSetting } from '../state/store'
import { useTranslation } from '../i18n'
import { SLEEVES } from '../appearance/sleeves'
import { ZOOM_PRESETS, isZoomPreset, stepZoom, zoomPercent } from '../appearance/zoom'
import type { ManaPaymentStored } from '../state/persistence'
import { saveGameLogAutoSave } from '../state/persistence'
import { clearAutoAnswers, removeAutoAnswer } from '../game/autoAnswers'
import { PhaseStopGrid } from '../game/PhaseStopSelector'
import { togglePhaseStop } from '../game/phaseStops'
import SoundFxControls from './SoundFxControls'
import Toggle from '../ui/Toggle'
import '../appearance/SleevePickerModal.css'
import '../game/GameMenu.css'
import '../game/PhaseStopSelector.css'
import './SettingsModal.css'

type SettingsSection = 'language' | 'interface' | 'board' | 'sound' | 'gameplay'

interface Props {
  onClose: () => void
  initialSection?: SettingsSection
}

const LAYOUTS: Array<{ id: 'standard' | 'pod' | 'arena'; labelKey: string; descKey: string }> = [
  { id: 'standard', labelKey: 'board_standard', descKey: 'board_standard_desc' },
  { id: 'pod', labelKey: 'board_pod', descKey: 'board_pod_desc' },
  { id: 'arena', labelKey: 'board_arena', descKey: 'board_arena_desc' },
]

function LanguageSection() {
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

function InterfaceSection() {
  const { t, lang } = useTranslation()
  const settings = useSettings()
  const stops = ZOOM_PRESETS.map((value) => ({ value, label: `${Math.round(value * 100)}%` }))
  const cjkLang = lang === 'ja' || lang === 'zhs'
  return (
    <div>
      <h3 className="settings-section-title">Tamaño de interfaz</h3>
      <p className="settings-hint">Escala global. 115-150% recomendado para chino/japonés (caracteres más densos).</p>
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
        label="Boost automático CJK (+15% en 日本語/中文)"
        disabled={!cjkLang}
        title={cjkLang ? undefined : 'Solo aplica con la interfaz en 日本語/中文'}
      />
    </div>
  )
}

function BoardSection() {
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

function SoundSection() {
  return (
    <div className="game-menu-fx" data-testid="settings-sound-card">
      <SoundFxControls />
    </div>
  )
}

function GameplaySection() {
  const { t } = useTranslation()
  const settings = useSettings()
  const manaRows: Array<{ key: keyof ManaPaymentStored; label: string; tip: string }> = [
    { key: 'auto', label: t('game', 'mana_payment_auto'), tip: t('game', 'mana_payment_auto_tip') },
    { key: 'restricted', label: t('game', 'mana_payment_restricted'), tip: t('game', 'mana_payment_restricted_tip') },
    { key: 'useFirstAbility', label: t('game', 'mana_payment_first'), tip: t('game', 'mana_payment_first_tip') },
    { key: 'confirmEmptyPool', label: t('game', 'mana_payment_confirm'), tip: t('game', 'mana_payment_confirm_tip') },
  ]
  return (
    <div>
      <h3 className="settings-section-title">{t('game', 'automation')}</h3>
      <Toggle
        checked={settings.holdPriority}
        onChange={(v) => setSetting('holdPriority', v)}
        label={t('game', 'hold_priority')}
        title={t('game', 'hold_priority_title')}
      />
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
        checked={settings.gameLogAutoSave}
        onChange={(v) => {
          setSetting('gameLogAutoSave', v)
          saveGameLogAutoSave(v)
        }}
        label={t('system', 'log_autosave')}
        title={t('system', 'log_autosave_hint')}
      />
      <h3 className="settings-section-title">{t('game', 'mana_payment_title')}</h3>
      {manaRows.map((row) => (
        <Toggle
          key={row.key}
          checked={settings.manaPayment[row.key]}
          onChange={() => setSetting('manaPayment', { ...settings.manaPayment, [row.key]: !settings.manaPayment[row.key] })}
          label={row.label}
          title={row.tip}
        />
      ))}
      <h3 className="settings-section-title">{t('game', 'phase_stops_default_title')}</h3>
      <p className="settings-hint">{t('game', 'phase_stops_default_hint')}</p>
      <div className="phase-stop-selector" data-testid="settings-phase-stops">
        <PhaseStopGrid
          value={settings.phaseStops}
          onToggle={(turn, key) => setSetting('phaseStops', togglePhaseStop(settings.phaseStops, turn, key))}
          idPrefix="settings"
        />
      </div>
      <h3 className="settings-section-title">{t('game', 'auto_answers_title', { count: settings.autoAnswers.length })}</h3>
      {settings.autoAnswers.length === 0 && (
        <p className="settings-hint">{t('game', 'auto_answers_empty')}</p>
      )}
      {settings.autoAnswers.map((rule) => (
        <div key={rule.id} className="settings-auto-row">
          <span className="settings-auto-text" title={rule.pattern}>{rule.pattern}</span>
          <span className={`settings-auto-badge ${rule.answer ? 'is-yes' : 'is-no'}`}>
            {rule.answer ? t('common', 'yes') : t('common', 'no')}
          </span>
          <button
            type="button"
            className="settings-auto-delete"
            aria-label={t('game', 'auto_answers_delete', { pattern: rule.pattern })}
            onClick={() => setSetting('autoAnswers', removeAutoAnswer(settings.autoAnswers, rule.id))}
          >
            ✕
          </button>
        </div>
      ))}
      {settings.autoAnswers.length > 0 && (
        <button
          type="button"
          className="settings-link-btn"
          onClick={() => setSetting('autoAnswers', clearAutoAnswers())}
        >
          {t('game', 'auto_answers_clear')}
        </button>
      )}
    </div>
  )
}

export default function SettingsModal({ onClose, initialSection = 'language' }: Props) {
  const { t } = useTranslation()
  const [section, setSection] = useState<SettingsSection>(initialSection)
  const nav: Array<{ id: SettingsSection; label: string }> = [
    { id: 'language', label: t('lobby', 'settings_language') },
    { id: 'interface', label: t('lobby', 'settings_interface') },
    { id: 'board', label: t('lobby', 'settings_board') },
    { id: 'sound', label: t('lobby', 'settings_sound') },
    { id: 'gameplay', label: t('lobby', 'settings_gameplay') },
  ]

  return (
    <div className="overlay" onClick={onClose} data-testid="settings-modal">
      <div className="dialog panel settings-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t('common', 'settings')}>
        <div className="settings-header">
          <h2>{t('common', 'settings')}</h2>
          <button type="button" className="settings-close" onClick={onClose} data-testid="settings-close">✕</button>
        </div>
        <div className="settings-body">
          <nav className="settings-nav" aria-label={t('common', 'settings')}>
            {nav.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`settings-nav-item ${section === item.id ? 'active' : ''}`}
                aria-pressed={section === item.id}
                onClick={() => setSection(item.id)}
                data-testid={`settings-nav-${item.id}`}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="settings-content" data-testid={`settings-section-${section}`}>
            {section === 'language' && <LanguageSection />}
            {section === 'interface' && <InterfaceSection />}
            {section === 'board' && <BoardSection />}
            {section === 'sound' && <SoundSection />}
            {section === 'gameplay' && <GameplaySection />}
          </div>
        </div>
      </div>
    </div>
  )
}
