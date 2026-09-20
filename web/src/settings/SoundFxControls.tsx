import { FX_SPEEDS } from '../board/fx'
import Tabs from '../ui/Tabs'
import { useSettings, setSetting } from '../state/store'
import { useTranslation } from '../i18n'
import { soundManager } from '../audio/soundManager'
import { Switch } from '../ui/Toggle'

export default function SoundFxControls() {
  const { t } = useTranslation()
  const settings = useSettings()

  return (
    <>
      <div className="fx-popover-row">
        <div className="fx-popover-text">
          <span className="fx-popover-label">{t('game', 'fx_effects')}</span>
          <span className="fx-popover-hint">{t('game', 'fx_effects_hint')}</span>
        </div>
        <Switch
          checked={settings.effects}
          title={t('game', 'fx_effects_hint')}
          onChange={(next) => setSetting('effects', next)}
        />
      </div>
      <div className="fx-popover-row">
        <span className="fx-popover-label">{t('game', 'fx_speed')}</span>
        <Tabs
          variant="segmented"
          size="sm"
          value={String(settings.animationSpeed)}
          onChange={(next) => setSetting('animationSpeed', Number(next) as typeof settings.animationSpeed)}
          items={FX_SPEEDS.map((s) => ({ id: String(s), label: `${s}×` }))}
        />
      </div>
      <div className="fx-popover-divider" />
      <div className="fx-popover-row">
        <div className="fx-popover-text">
          <span className="fx-popover-label">{t('game', 'sound_enabled')}</span>
          <span className="fx-popover-hint">{t('game', 'sound_enabled_hint')}</span>
        </div>
        <Switch
          checked={settings.soundEnabled}
          title={t('game', 'sound_enabled_hint')}
          onChange={(next) => {
            setSetting('soundEnabled', next)
            if (next) soundManager.play('ui_click', 'ui')
          }}
        />
      </div>
      <div className="fx-popover-row">
        <span className="fx-popover-label">{t('game', 'sound_volume_master')}</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          className="audio-slider"
          value={settings.masterVolume}
          disabled={!settings.soundEnabled}
          aria-label={t('game', 'sound_volume_master')}
          onChange={(e) => setSetting('masterVolume', parseFloat(e.target.value))}
        />
      </div>
      <div className="fx-popover-row">
        <span className="fx-popover-label">{t('game', 'sound_volume_sfx')}</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          className="audio-slider"
          value={settings.sfxVolume}
          disabled={!settings.soundEnabled}
          aria-label={t('game', 'sound_volume_sfx')}
          onChange={(e) => setSetting('sfxVolume', parseFloat(e.target.value))}
        />
      </div>
      <div className="fx-popover-row">
        <span className="fx-popover-label">{t('game', 'sound_volume_ui')}</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          className="audio-slider"
          value={settings.uiVolume}
          disabled={!settings.soundEnabled}
          aria-label={t('game', 'sound_volume_ui')}
          onChange={(e) => setSetting('uiVolume', parseFloat(e.target.value))}
        />
      </div>
    </>
  )
}
