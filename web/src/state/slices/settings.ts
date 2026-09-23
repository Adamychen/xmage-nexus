import { loadAutoAnswers, loadChoiceMemory, loadFxSettings, loadAudioSettings, loadMusicSettings, loadAppearanceSettings, loadManaPayment, loadHandRequestsAllowed, loadPhaseStops, loadGameLogAutoSave, loadBrowserNotifications, loadSmartStops } from '../persistence'
import type { ZoomLevel, ManaPaymentStored } from '../persistence'
import type { PhaseStops } from '../../net/commands'
import type { AutoAnswerRule } from '../../game/autoAnswers'
import type { ChoiceMemoryRule } from '../../game/choiceMemory'
import { normalizePlaymat, type PlaymatId } from '../../appearance/playmats'

export interface SettingsState {
  autoKeepMulligan: boolean
  autoPass: boolean
  smartStops: boolean
  autoSubmitSideboard?: boolean
  holdPriority: boolean
  autoAnswers: AutoAnswerRule[]
  choiceMemory: ChoiceMemoryRule[]
  manaPayment: ManaPaymentStored
  allowHandRequests: boolean
  phaseStops: PhaseStops
  gameLogAutoSave: boolean
  browserNotifications: boolean
  boardLayout: 'standard' | 'pod' | 'arena'
  boardLayoutManual: boolean
  effects: boolean
  animationSpeed: number
  soundEnabled: boolean
  masterVolume: number
  sfxVolume: number
  uiVolume: number
  musicEnabled: boolean
  musicVolume: number
  sleeveId: string
  playmatId: PlaymatId
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
    smartStops: loadSmartStops(),
    holdPriority: false,
    autoAnswers: loadAutoAnswers().map((entry, index) => ({ id: `auto-${index}`, ...entry })),
    choiceMemory: loadChoiceMemory().map((entry, index) => ({ id: `choice-${index}`, ...entry })),
    manaPayment: loadManaPayment(),
    allowHandRequests: loadHandRequestsAllowed(),
    phaseStops: loadPhaseStops(),
    gameLogAutoSave: loadGameLogAutoSave(),
    browserNotifications: loadBrowserNotifications(),
    ...loadFxSettings(),
    ...loadAudioSettings(),
    ...loadMusicSettings(),
    ...loadAppearanceSettings(),
    boardLayoutManual: loadAppearanceSettings().boardLayoutManual ?? false,
    playmatId: normalizePlaymat(loadAppearanceSettings().playmatId),
  },
}
