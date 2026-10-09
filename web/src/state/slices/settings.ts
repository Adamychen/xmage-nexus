import { loadAutoAnswers, loadChoiceMemory, loadFxSettings, loadAudioSettings, loadMusicSettings, loadAppearanceSettings, loadManaPayment, loadHandRequestsAllowed, loadPhaseStops, loadGameLogAutoSave, loadBrowserNotifications, loadSmartStops, loadGameplayPreset } from '../persistence'
import type { ZoomLevel, ManaPaymentStored } from '../persistence'
import type { PhaseStops } from '../../net/commands'
import type { PrioritySoundMode } from '../../audio/prioritySound'
import type { AutoAnswerRule } from '../../game/autoAnswers'
import type { ChoiceMemoryRule } from '../../game/choiceMemory'
import { normalizePlaymat, type PlaymatId } from '../../appearance/playmats'
import { normalizeCardStyle, normalizeTapStyle, type CardStyle, type TapStyle } from '../../board/compactCard'
import { normalizePtBadgeMode, normalizeShowHandCost, normalizeSicknessStyle, type PtBadgeMode, type SicknessStyle } from '../../board/cardOverlays'
import { gameplayPreset, isGameplayPresetId, type GameplayPresetId } from '../../settings/gameplayPresets'

export interface SettingsState {
  autoKeepMulligan: boolean
  smartStops: boolean
  gameplayPreset: GameplayPresetId | null
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
  prioritySound: PrioritySoundMode
  musicEnabled: boolean
  musicVolume: number
  sleeveId: string
  playmatId: PlaymatId
  cardStyle: CardStyle
  tapStyle: TapStyle
  showHandCost: boolean
  ptBadgeMode: PtBadgeMode
  sicknessStyle: SicknessStyle
  uiScale: ZoomLevel
  cjkBoost: boolean
  transparentDialogs: boolean
}

export interface SettingsSlice {
  settings: SettingsState
}

const storedPresetId = loadGameplayPreset()
const storedPreset = isGameplayPresetId(storedPresetId) ? gameplayPreset(storedPresetId) : null

export const initialSettings: SettingsSlice = {
  settings: {
    autoKeepMulligan: false,
    smartStops: loadSmartStops(),
    gameplayPreset: storedPreset?.id ?? null,
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
    transparentDialogs: loadAppearanceSettings().transparentDialogs ?? false,
    playmatId: normalizePlaymat(loadAppearanceSettings().playmatId),
    cardStyle: normalizeCardStyle(loadAppearanceSettings().cardStyle),
    tapStyle: normalizeTapStyle(loadAppearanceSettings().tapStyle),
    showHandCost: normalizeShowHandCost(loadAppearanceSettings().showHandCost),
    ptBadgeMode: normalizePtBadgeMode(loadAppearanceSettings().ptBadgeMode),
    sicknessStyle: normalizeSicknessStyle(loadAppearanceSettings().sicknessStyle),
    ...(storedPreset ? storedPreset.bundle : null),
  },
}
