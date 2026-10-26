import { FX_SPEEDS } from '../board/fx'
import { useSettings, setSetting } from '../state/store'
import { useTranslation } from '../i18n'
import { soundManager } from '../audio/soundManager'
import { PRIORITY_SOUND_MODES, type PrioritySoundMode } from '../audio/prioritySound'
import { Segmented, SettingsGroup, SettingsRow, SwitchRow } from './settingsUi'

const PRIORITY_LABEL = {
  'every-prompt': 'sound_priority_every_prompt',
  'on-gain': 'sound_priority_on_gain',
  off: 'sound_priority_off',
} as const

type VolumeKey = 'masterVolume' | 'sfxVolume' | 'musicVolume' | 'uiVolume'

function VolumeRow({ id, label, volumeKey, disabled }: { id: string; label: string; volumeKey: VolumeKey; disabled: boolean }) {
  const settings = useSettings()
  const value = settings[volumeKey]
  return (
    <SettingsRow id={id} label={label} disabled={disabled}>
      {({ controlId }) => (
        <>
          <input
            id={controlId}
            type="range"
            min="0"
            max="1"
            step="0.05"
            className="audio-slider"
            value={value}
            disabled={disabled}
            onChange={(e) => setSetting(volumeKey, parseFloat(e.target.value))}
          />
          <span className="settings-row-value">{Math.round(value * 100)}%</span>
        </>
      )}
    </SettingsRow>
  )
}

export default function SoundFxControls() {
  const { t } = useTranslation()
  const settings = useSettings()
  const muted = !settings.soundEnabled

  return (
    <>
      <SettingsGroup title={t('lobby', 'settings_group_animations')}>
        <SwitchRow
          id="fx-effects"
          label={t('game', 'fx_effects')}
          hint={t('game', 'fx_effects_hint')}
          checked={settings.effects}
          onChange={(next) => setSetting('effects', next)}
        />
        <SettingsRow id="fx-speed" label={t('game', 'fx_speed')} disabled={!settings.effects}>
          {({ labelId }) => (
            <Segmented
              labelledBy={labelId}
              value={String(settings.animationSpeed)}
              disabled={!settings.effects}
              onChange={(next) => setSetting('animationSpeed', Number(next) as typeof settings.animationSpeed)}
              options={FX_SPEEDS.map((s) => ({ id: String(s), label: `${s}×` }))}
            />
          )}
        </SettingsRow>
      </SettingsGroup>
      <SettingsGroup title={t('lobby', 'settings_group_sound')}>
        <SwitchRow
          id="sound-enabled"
          label={t('game', 'sound_enabled')}
          hint={t('game', 'sound_enabled_hint')}
          checked={settings.soundEnabled}
          onChange={(next) => {
            setSetting('soundEnabled', next)
            if (next) soundManager.play('ui_click', 'ui')
          }}
        />
        <VolumeRow id="volume-master" label={t('game', 'sound_volume_master')} volumeKey="masterVolume" disabled={muted} />
        <VolumeRow id="volume-sfx" label={t('game', 'sound_volume_sfx')} volumeKey="sfxVolume" disabled={muted} />
        <VolumeRow id="volume-ui" label={t('game', 'sound_volume_ui')} volumeKey="uiVolume" disabled={muted} />
        <SettingsRow id="priority-sound" label={t('game', 'sound_priority_mode')} hint={t('game', 'sound_priority_mode_hint')} disabled={muted}>
          {({ labelId }) => (
            <Segmented
              labelledBy={labelId}
              value={settings.prioritySound}
              disabled={muted}
              onChange={(next) => setSetting('prioritySound', next as PrioritySoundMode)}
              options={PRIORITY_SOUND_MODES.map((m) => ({ id: m, label: t('game', PRIORITY_LABEL[m]) }))}
            />
          )}
        </SettingsRow>
      </SettingsGroup>
      <SettingsGroup title={t('lobby', 'settings_group_music')}>
        <SwitchRow
          id="music-enabled"
          label={t('game', 'music_enabled')}
          hint={t('game', 'music_enabled_hint')}
          checked={settings.musicEnabled}
          disabled={muted}
          onChange={(next) => setSetting('musicEnabled', next)}
        />
        <VolumeRow id="music-volume" label={t('game', 'music_volume')} volumeKey="musicVolume" disabled={muted || !settings.musicEnabled} />
      </SettingsGroup>
    </>
  )
}
