import { applyGameplayPreset, useSettings } from '../state/store'
import { useTranslation } from '../i18n'
import Button from '../ui/Button'
import { GAMEPLAY_PRESETS } from './gameplayPresets'
import './SettingsModal.css'

export default function PresetPicker() {
  const { t } = useTranslation()
  const settings = useSettings()
  return (
    <div className="settings-cards" data-testid="settings-presets">
      {GAMEPLAY_PRESETS.map((preset) => (
        <Button
          key={preset.id}
          variant="ghost"
          className={`settings-card ${settings.gameplayPreset === preset.id ? 'selected' : ''}`}
          aria-pressed={settings.gameplayPreset === preset.id}
          onClick={() => applyGameplayPreset(preset.id)}
          data-testid={`settings-preset-${preset.id}`}
        >
          <span className="settings-card-label">{t('game', preset.labelKey)}</span>
          <span className="settings-card-desc">{t('game', preset.descKey)}</span>
          {settings.gameplayPreset === preset.id && <span className="settings-card-check">✓</span>}
        </Button>
      ))}
    </div>
  )
}
