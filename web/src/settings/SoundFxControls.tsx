import { FX_SPEEDS } from '../board/fx'
import { useSettings, setSetting } from '../state/store'
import { useTranslation } from '../i18n'
import { soundManager } from '../audio/soundManager'

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
        <button
          type="button"
          className={`fx-toggle ${settings.effects ? 'on' : ''}`}
          role="switch"
          aria-checked={settings.effects}
          title={t('game', 'fx_effects_hint')}
          onClick={() => setSetting('effects', !settings.effects)}
        >
          <span className="fx-toggle-knob" />
        </button>
      </div>
      <div className="fx-popover-row">
        <span className="fx-popover-label">{t('game', 'fx_speed')}</span>
        <div className="fx-speed-group">
          {FX_SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              className={`fx-speed-btn ${settings.animationSpeed === s ? 'active' : ''}`}
              onClick={() => setSetting('animationSpeed', s)}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>
      <div className="fx-popover-divider" />
      <div className="fx-popover-row">
        <div className="fx-popover-text">
          <span className="fx-popover-label">{t('game', 'sound_enabled')}</span>
          <span className="fx-popover-hint">{t('game', 'sound_enabled_hint')}</span>
        </div>
        <button
          type="button"
          className={`fx-toggle ${settings.soundEnabled ? 'on' : ''}`}
          role="switch"
          aria-checked={settings.soundEnabled}
          title={t('game', 'sound_enabled_hint')}
          onClick={() => {
            const next = !settings.soundEnabled
            setSetting('soundEnabled', next)
            if (next) soundManager.play('ui_click', 'ui')
          }}
        >
          <span className="fx-toggle-knob" />
        </button>
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
          onChange={(e) => setSetting('uiVolume', parseFloat(e.target.value))}
        />
      </div>
    </>
  )
}
