import { useState } from 'react'
import { useSettings, setSetting } from '../state/store'
import { useTranslation } from '../i18n'
import type { ManaPaymentStored } from '../state/persistence'
import { saveGameLogAutoSave } from '../state/persistence'
import { clearAutoAnswers, removeAutoAnswer } from '../game/autoAnswers'
import { PhaseStopGrid } from '../game/PhaseStopSelector'
import { togglePhaseStop } from '../game/phaseStops'
import Toggle from '../ui/Toggle'
import DialogShell from '../ui/DialogShell'
import { LanguageSection, InterfaceSection, BoardSection, SoundSection } from './sections'
import '../game/GameMenu.css'
import '../game/PhaseStopSelector.css'
import './SettingsModal.css'

type SettingsSection = 'language' | 'interface' | 'board' | 'sound' | 'gameplay'

interface Props {
  onClose: () => void
  initialSection?: SettingsSection
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
    <DialogShell
      labelledBy="settings-title"
      titleId="settings-title"
      size="lg"
      testId="settings-modal"
      legacyPanelClass="settings-modal"
      kickerIcon="settings"
      kickerLabel={nav.find((item) => item.id === section)?.label ?? t('common', 'settings')}
      title={t('common', 'settings')}
      topRight={(
        <button type="button" className="settings-close" onClick={onClose} data-testid="settings-close">✕</button>
      )}
      onBackdropClick={onClose}
    >
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
        <div className="settings-footer">
          <button
            type="button"
            className="settings-link-btn"
            onClick={() => window.dispatchEvent(new CustomEvent('nexus:open-setup'))}
            data-testid="settings-review-setup"
          >
            {t('setup', 'review')}
          </button>
        </div>
    </DialogShell>
  )
}
