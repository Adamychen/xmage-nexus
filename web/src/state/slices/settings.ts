import { loadAutoAnswers, loadFxSettings, loadAudioSettings, loadAppearanceSettings } from '../persistence'
import type { UiScale } from '../persistence'
import type { AutoAnswerRule } from '../../game/autoAnswers'

export interface SettingsState {
  autoKeepMulligan: boolean
  autoPass: boolean
  autoSubmitSideboard?: boolean
  holdPriority: boolean
  autoAnswers: AutoAnswerRule[]
  boardLayout: 'standard' | 'pod' | 'arena'
  effects: boolean
  animationSpeed: number
  soundEnabled: boolean
  masterVolume: number
  sfxVolume: number
  uiVolume: number
  sleeveId: string
  uiScale: UiScale
  cjkBoost: boolean
}

export interface SettingsSlice {
  settings: SettingsState
}

export const initialSettings: SettingsSlice = {
  settings: {
    autoKeepMulligan: false,
    autoPass: false,
    holdPriority: false,
    autoAnswers: loadAutoAnswers().map((entry, index) => ({ id: `auto-${index}`, ...entry })),
    ...loadFxSettings(),
    ...loadAudioSettings(),
    ...loadAppearanceSettings(),
  },
}
