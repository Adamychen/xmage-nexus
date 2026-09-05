import { loadAutoAnswers, loadFxSettings, loadAudioSettings, loadAppearanceSettings, loadManaPayment } from '../persistence'
import type { ZoomLevel, ManaPaymentStored } from '../persistence'
import type { AutoAnswerRule } from '../../game/autoAnswers'

export interface SettingsState {
  autoKeepMulligan: boolean
  autoPass: boolean
  autoSubmitSideboard?: boolean
  holdPriority: boolean
  autoAnswers: AutoAnswerRule[]
  manaPayment: ManaPaymentStored
  boardLayout: 'standard' | 'pod' | 'arena'
  effects: boolean
  animationSpeed: number
  soundEnabled: boolean
  masterVolume: number
  sfxVolume: number
  uiVolume: number
  sleeveId: string
  uiScale: ZoomLevel
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
    manaPayment: loadManaPayment(),
    ...loadFxSettings(),
    ...loadAudioSettings(),
    ...loadAppearanceSettings(),
  },
}
