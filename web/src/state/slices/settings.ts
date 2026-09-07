import { loadAutoAnswers, loadChoiceMemory, loadFxSettings, loadAudioSettings, loadAppearanceSettings, loadManaPayment, loadHandRequestsAllowed, loadPhaseStops, loadGameLogAutoSave } from '../persistence'
import type { ZoomLevel, ManaPaymentStored } from '../persistence'
import type { PhaseStops } from '../../net/commands'
import type { AutoAnswerRule } from '../../game/autoAnswers'
import type { ChoiceMemoryRule } from '../../game/choiceMemory'

export interface SettingsState {
  autoKeepMulligan: boolean
  autoPass: boolean
  autoSubmitSideboard?: boolean
  holdPriority: boolean
  autoAnswers: AutoAnswerRule[]
  choiceMemory: ChoiceMemoryRule[]
  manaPayment: ManaPaymentStored
  allowHandRequests: boolean
  phaseStops: PhaseStops
  gameLogAutoSave: boolean
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
    choiceMemory: loadChoiceMemory().map((entry, index) => ({ id: `choice-${index}`, ...entry })),
    manaPayment: loadManaPayment(),
    allowHandRequests: loadHandRequestsAllowed(),
    phaseStops: loadPhaseStops(),
    gameLogAutoSave: loadGameLogAutoSave(),
    ...loadFxSettings(),
    ...loadAudioSettings(),
    ...loadAppearanceSettings(),
  },
}
