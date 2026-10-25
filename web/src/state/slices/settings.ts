import { loadAutoAnswers, loadChoiceMemory, loadFxSettings, loadAudioSettings, loadMusicSettings, loadAppearanceSettings, loadManaPayment, loadHandRequestsAllowed, loadPhaseStops, loadGameLogAutoSave, loadBrowserNotifications, loadBoardRewind, loadTurnRecap, loadSmartStops, loadGameplayPreset, loadDeckStacksScale } from '../persistence'
import type { ZoomLevel, ManaPaymentStored } from '../persistence'
import type { PhaseStops } from '../../net/commands'
import type { PrioritySoundMode } from '../../audio/prioritySound'
import type { AutoAnswerRule } from '../../game/autoAnswers'
import type { ChoiceMemoryRule } from '../../game/choiceMemory'
import { normalizePlaymat, type PlaymatId } from '../../appearance/playmats'
import { normalizeCardStyle, normalizeTapStyle, type CardStyle, type TapStyle } from '../../board/compactCard'
import { normalizeBoardSpotlight, normalizeBoardSpotlightPanel, normalizeBoardFill, normalizeStackCaption, normalizeCardRender, normalizeHandRail, normalizeHandRailWidth, normalizeHandRow, normalizePtBadgeMode, normalizeShowHandCost, normalizeShowManaSource, normalizeSicknessStyle, normalizeKeywordIconSet, normalizeKeywordAuraMode, type CardRender, type KeywordIconSet, type KeywordAuraMode, type PtBadgeMode, type SicknessStyle } from '../../board/cardOverlays'
import { normalizeGameUi, type GameUi } from '../../game/gameUi'
import { normalizeAppearanceChoice, type AppearanceChoice } from '../../appearance/appearanceChoice'
import { normalizeCardPreviewScale } from '../../board/cardPreviewScale'
import { gameplayPreset, isGameplayPresetId, type GameplayPresetId } from '../../settings/gameplayPresets'

export interface SettingsState {
  autoKeepMulligan: boolean
  appearance: AppearanceChoice
  smartStops: boolean
  deckStacksScale: number
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
  boardRewind: boolean
  turnRecap: boolean
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
  showManaSource: boolean
  ptBadgeMode: PtBadgeMode
  cardRender: CardRender
  handRail: boolean
  handRailWidth: number
  handRow: boolean
  boardFill: boolean
  boardSpotlight: boolean
  boardSpotlightPanel: number
  stackCaption: boolean
  gameUi: GameUi
  cardPreviewScale: number
  sicknessStyle: SicknessStyle
  keywordIcons: KeywordIconSet
  keywordAura: KeywordAuraMode
  uiScale: ZoomLevel
  cjkBoost: boolean
  transparentDialogs: boolean
}

export interface SettingsSlice {
  settings: SettingsState
}

export function loadAppearanceSlice() {
  const appearance = loadAppearanceSettings()
  return {
    ...appearance,
    appearance: normalizeAppearanceChoice(appearance.appearance),
    boardLayoutManual: appearance.boardLayoutManual ?? false,
    transparentDialogs: appearance.transparentDialogs ?? false,
    playmatId: normalizePlaymat(appearance.playmatId),
    cardStyle: normalizeCardStyle(appearance.cardStyle),
    tapStyle: normalizeTapStyle(appearance.tapStyle),
    showHandCost: normalizeShowHandCost(appearance.showHandCost),
    showManaSource: normalizeShowManaSource(appearance.showManaSource),
    ptBadgeMode: normalizePtBadgeMode(appearance.ptBadgeMode),
    cardRender: normalizeCardRender(appearance.cardRender),
    handRail: normalizeHandRail(appearance.handRail),
    handRailWidth: normalizeHandRailWidth(appearance.handRailWidth),
    handRow: normalizeHandRow(appearance.handRow),
    boardFill: normalizeBoardFill(appearance.boardFill),
    boardSpotlight: normalizeBoardSpotlight(appearance.boardSpotlight),
    boardSpotlightPanel: normalizeBoardSpotlightPanel(appearance.boardSpotlightPanel),
    stackCaption: normalizeStackCaption(appearance.stackCaption),
    gameUi: normalizeGameUi(appearance.gameUi),
    cardPreviewScale: normalizeCardPreviewScale(appearance.cardPreviewScale),
    sicknessStyle: normalizeSicknessStyle(appearance.sicknessStyle),
    keywordIcons: normalizeKeywordIconSet(appearance.keywordIcons),
    keywordAura: normalizeKeywordAuraMode(appearance.keywordAura),
  }
}

const storedPresetId = loadGameplayPreset()
const storedPreset = isGameplayPresetId(storedPresetId) ? gameplayPreset(storedPresetId) : null

export const initialSettings: SettingsSlice = {
  settings: {
    autoKeepMulligan: false,
    smartStops: loadSmartStops(),
    deckStacksScale: loadDeckStacksScale(),
    gameplayPreset: storedPreset?.id ?? null,
    holdPriority: false,
    autoAnswers: loadAutoAnswers().map((entry, index) => ({ id: `auto-${index}`, ...entry })),
    choiceMemory: loadChoiceMemory().map((entry, index) => ({ id: `choice-${index}`, ...entry })),
    manaPayment: loadManaPayment(),
    allowHandRequests: loadHandRequestsAllowed(),
    phaseStops: loadPhaseStops(),
    gameLogAutoSave: loadGameLogAutoSave(),
    browserNotifications: loadBrowserNotifications(),
    boardRewind: loadBoardRewind(),
    turnRecap: loadTurnRecap(),
    ...loadFxSettings(),
    ...loadAudioSettings(),
    ...loadMusicSettings(),
    ...loadAppearanceSlice(),
    ...(storedPreset ? storedPreset.bundle : null),
  },
}
