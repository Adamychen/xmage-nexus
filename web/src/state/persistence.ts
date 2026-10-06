import type { PhaseStops } from '../net/commands'
import type { DeckJson } from '../net/types'
import type { DraftState } from './slices/limited'
import { mergePhaseStops } from '../game/phaseStops'

export interface ConnectionInfo {
  /** Host del proxy WebSocket (ws://wsHost:proxyPort). */
  wsHost: string
  /** Puerto WS del proxy (8787=real, 8789=fake E2E). */
  proxyPort: number
  /** Host del servidor XMage destino (distinto del proxy permite jugar contra
   *  servers remotos con el proxy local). */
  serverHost: string
  port: number
  username: string
  password: string
  flagName?: string
  avatarId?: number
}

export interface ActiveGamePersistence {
  gameId: string
  tableId?: string | null
  role?: 'player' | 'watcher'
  savedAt: number
}

const STORAGE_KEY = 'mage-web-conn'
const ACTIVE_GAME_KEY = 'mage-web-active-game'
const ACTIVE_GAME_MAX_AGE_MS = 3 * 60 * 60 * 1000 // 3 horas

class MemoryStorage implements Storage {
  private data: Record<string, string> = {}
  get length() {
    return Object.keys(this.data).length
  }
  clear() {
    this.data = {}
  }
  getItem(key: string): string | null {
    return this.data[key] ?? null
  }
  key(index: number): string | null {
    return Object.keys(this.data)[index] ?? null
  }
  removeItem(key: string) {
    delete this.data[key]
  }
  setItem(key: string, value: string) {
    this.data[key] = value
  }
}

const memoryStorage = new MemoryStorage()

function getStorage(): Storage {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.getItem('__mage_probe__')
      return window.localStorage
    }
  } catch {}
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.getItem('__mage_probe__')
      return localStorage
    }
  } catch {}
  return memoryStorage
}

function writeJson(key: string, value: unknown) {
  try {
    getStorage().setItem(key, JSON.stringify(value))
  } catch {}
}

function readJson<T>(key: string): T | undefined {
  try {
    const raw = getStorage().getItem(key)
    if (raw == null) return undefined
    return JSON.parse(raw) as T
  } catch {
    return undefined
  }
}

export function loadConn(): ConnectionInfo | null {
  const parsed = readJson<Partial<ConnectionInfo> & { host?: string }>(STORAGE_KEY)
  if (parsed !== undefined) {
    if (parsed && !parsed.wsHost) {
      return {
        wsHost: parsed.host ?? 'localhost',
        proxyPort: (parsed as { proxyPort?: number }).proxyPort ?? 8787,
        serverHost: parsed.host ?? parsed.serverHost ?? 'localhost',
        port: parsed.port ?? 17171,
        username: parsed.username ?? '',
        password: parsed.password ?? '',
      }
    }
    return { proxyPort: 8787, ...parsed } as ConnectionInfo
  }
  return null
}

export function saveConn(conn: ConnectionInfo | null) {
  if (conn) writeJson(STORAGE_KEY, conn)
  else try { getStorage().removeItem(STORAGE_KEY) } catch {}
}

export function loadActiveGame(): ActiveGamePersistence | null {
  const parsed = readJson<ActiveGamePersistence>(ACTIVE_GAME_KEY)
  if (parsed && parsed.gameId && typeof parsed.savedAt === 'number') {
    if (Date.now() - parsed.savedAt < ACTIVE_GAME_MAX_AGE_MS) {
      return parsed
    }
    clearActiveGame()
  }
  return null
}

export function saveActiveGame(gameId: string | null, tableId?: string | null, role: 'player' | 'watcher' = 'player') {
  if (gameId) {
    const data: ActiveGamePersistence = {
      gameId,
      tableId: tableId ?? null,
      role,
      savedAt: Date.now(),
    }
    writeJson(ACTIVE_GAME_KEY, data)
  } else {
    clearActiveGame()
  }
}

/** Whether a login is the account of the saved connection (its active game
 *  and draft belong to it and must survive the login). */
export function isSameAccount(saved: ConnectionInfo | null, serverHost: string, port: number, username: string): boolean {
  if (!saved) return false
  return saved.serverHost.toLowerCase() === serverHost.toLowerCase()
    && saved.port === port
    && saved.username.toLowerCase() === username.toLowerCase()
}

export function clearActiveGame() {
  try {
    const storage = getStorage()
    storage.removeItem(ACTIVE_GAME_KEY)
  } catch {}
}

export interface ActiveDraftPersistence {
  /** Última instantánea del draft (el server no reenvía el estado al re-unirse). */
  draft: DraftState
  tournamentId?: string | null
  savedAt: number
}

const ACTIVE_DRAFT_KEY = 'mage-web-active-draft'
const ACTIVE_DRAFT_MAX_AGE_MS = 3 * 60 * 60 * 1000 // 3 horas

/** Draft en curso (instantánea + id) para recuperarlo tras recargar la página:
 *  el estado vive solo en memoria y el asiento autopickea por timeout. El server
 *  no responde `DRAFT_INIT` a un `joinDraft` en draft ya empezado, así que la
 *  instantánea es lo único que permite pintar el draft hasta el siguiente pick. */
export function loadActiveDraft(): ActiveDraftPersistence | null {
  const parsed = readJson<ActiveDraftPersistence>(ACTIVE_DRAFT_KEY)
  const draft = parsed?.draft
  if (
    parsed &&
    draft &&
    typeof draft.draftId === 'string' &&
    draft.draftId !== 'draft' &&
    draft.message &&
    typeof parsed.savedAt === 'number'
  ) {
    if (Date.now() - parsed.savedAt < ACTIVE_DRAFT_MAX_AGE_MS) {
      return parsed
    }
    clearActiveDraft()
  }
  return null
}

export function saveActiveDraft(draft: DraftState | null, tournamentId?: string | null) {
  if (draft && draft.draftId && draft.draftId !== 'draft' && draft.message) {
    const data: ActiveDraftPersistence = {
      draft,
      tournamentId: tournamentId ?? null,
      savedAt: Date.now(),
    }
    writeJson(ACTIVE_DRAFT_KEY, data)
  } else {
    clearActiveDraft()
  }
}

export function clearActiveDraft() {
  try {
    getStorage().removeItem(ACTIVE_DRAFT_KEY)
  } catch {}
}

const ACTIVE_DECK_KEY = 'mage-web-active-deck'
const EQUIPPED_DECK_ID_KEY = 'mage-web-equipped-deck-id'

/** Recuerda el id (catálogo de mazos) del mazo equipado, para poder marcarlo
 *  aunque se renombre (comparar por nombre fallaba). */
export function rememberEquippedDeckId(id: string | null | undefined) {
  try {
    const storage = getStorage()
    if (id) storage.setItem(EQUIPPED_DECK_ID_KEY, id)
    else storage.removeItem(EQUIPPED_DECK_ID_KEY)
  } catch {}
}

export function equippedDeckId(): string | null {
  try {
    return getStorage().getItem(EQUIPPED_DECK_ID_KEY)
  } catch {
    return null
  }
}

export function saveActiveDeck(deck: DeckJson | null) {
  if (deck) writeJson(ACTIVE_DECK_KEY, deck)
  else clearActiveDeck()
}

export function loadActiveDeck(): DeckJson | null {
  return readJson<DeckJson>(ACTIVE_DECK_KEY) ?? null
}

export function clearActiveDeck() {
  try {
    getStorage().removeItem(ACTIVE_DECK_KEY)
  } catch {}
}

export interface FxSettings {
  effects: boolean
  animationSpeed: number
}

const FX_SETTINGS_KEY = 'mage-web-settings'
const FX_SPEEDS = [0.5, 1, 1.5]
export const DEFAULT_FX_SETTINGS: FxSettings = { effects: true, animationSpeed: 1 }

export function loadFxSettings(): FxSettings {
  const parsed = readJson<Partial<FxSettings>>(FX_SETTINGS_KEY)
  if (parsed) {
    return {
      effects: parsed.effects !== false,
      animationSpeed: FX_SPEEDS.includes(parsed.animationSpeed as number)
        ? parsed.animationSpeed as number
        : DEFAULT_FX_SETTINGS.animationSpeed,
    }
  }
  return { ...DEFAULT_FX_SETTINGS }
}

export function saveFxSettings(fx: FxSettings) {
  writeJson(FX_SETTINGS_KEY, fx)
}

export interface AutoAnswerStored {
  pattern: string
  answer: boolean
  /** clave exacta del servidor (REQUEST_AUTO_ANSWER_TEXT_*), si se conoce */
  key?: string
}

const AUTO_ANSWERS_KEY = 'mage-web-auto-answers'

export function loadAutoAnswers(): AutoAnswerStored[] {
  const parsed = readJson<unknown>(AUTO_ANSWERS_KEY)
  if (Array.isArray(parsed)) {
    return parsed
      .filter((entry): entry is AutoAnswerStored => {
        const record = entry as Partial<AutoAnswerStored>
        return typeof record?.pattern === 'string' && typeof record?.answer === 'boolean'
      })
      .map((entry) => ({
        pattern: entry.pattern,
        answer: entry.answer,
        ...(typeof entry.key === 'string' && entry.key ? { key: entry.key } : null),
      }))
  }
  return []
}

export function saveAutoAnswers(rules: AutoAnswerStored[]) {
  writeJson(AUTO_ANSWERS_KEY, rules)
}

export interface ChoiceMemoryStored {
  pattern: string
  value: string
}

const CHOICE_MEMORY_KEY = 'mage-web-choice-memory'

export function loadChoiceMemory(): ChoiceMemoryStored[] {
  const parsed = readJson<unknown>(CHOICE_MEMORY_KEY)
  if (Array.isArray(parsed)) {
    return parsed
      .filter((entry): entry is ChoiceMemoryStored => {
        const record = entry as Partial<ChoiceMemoryStored>
        return typeof record?.pattern === 'string' && typeof record?.value === 'string'
      })
      .map((entry) => ({ pattern: entry.pattern, value: entry.value }))
  }
  return []
}

export function saveChoiceMemory(rules: ChoiceMemoryStored[]) {
  writeJson(CHOICE_MEMORY_KEY, rules)
}

export interface ManaPaymentStored {
  auto: boolean
  restricted: boolean
  useFirstAbility: boolean
  confirmEmptyPool: boolean
  smart: boolean
}

const MANA_PAYMENT_KEY = 'mage-web-mana-payment'
export const DEFAULT_MANA_PAYMENT: ManaPaymentStored = {
  auto: true,
  restricted: true,
  useFirstAbility: false,
  confirmEmptyPool: true,
  smart: false,
}

export function loadManaPayment(): ManaPaymentStored {
  const parsed = readJson<Partial<ManaPaymentStored>>(MANA_PAYMENT_KEY)
  if (parsed) {
    return {
      auto: typeof parsed.auto === 'boolean' ? parsed.auto : DEFAULT_MANA_PAYMENT.auto,
      restricted: typeof parsed.restricted === 'boolean' ? parsed.restricted : DEFAULT_MANA_PAYMENT.restricted,
      useFirstAbility:
        typeof parsed.useFirstAbility === 'boolean' ? parsed.useFirstAbility : DEFAULT_MANA_PAYMENT.useFirstAbility,
      confirmEmptyPool:
        typeof parsed.confirmEmptyPool === 'boolean'
          ? parsed.confirmEmptyPool
          : DEFAULT_MANA_PAYMENT.confirmEmptyPool,
      smart: typeof parsed.smart === 'boolean' ? parsed.smart : DEFAULT_MANA_PAYMENT.smart,
    }
  }
  return { ...DEFAULT_MANA_PAYMENT }
}

export function saveManaPayment(mana: ManaPaymentStored) {
  writeJson(MANA_PAYMENT_KEY, mana)
}

const HAND_REQUESTS_KEY = 'mage-web-hand-requests'

export function loadHandRequestsAllowed(): boolean {
  const parsed = readJson<unknown>(HAND_REQUESTS_KEY)
  if (parsed === undefined) return true
  return parsed === true
}

export function saveHandRequestsAllowed(allowed: boolean) {
  writeJson(HAND_REQUESTS_KEY, allowed)
}

const SMART_STOPS_KEY = 'mage-web-smart-stops'

export function loadSmartStops(): boolean {
  try {
    return getStorage().getItem(SMART_STOPS_KEY) === 'true'
  } catch {}
  return false
}

export function saveSmartStops(enabled: boolean) {
  try {
    getStorage().setItem(SMART_STOPS_KEY, String(enabled))
  } catch {}
}

const GAMEPLAY_PRESET_KEY = 'mage-web-gameplay-preset'

export function loadGameplayPreset(): string | null {
  try {
    return getStorage().getItem(GAMEPLAY_PRESET_KEY)
  } catch {}
  return null
}

export function saveGameplayPreset(id: string | null) {
  try {
    if (id) getStorage().setItem(GAMEPLAY_PRESET_KEY, id)
    else getStorage().removeItem(GAMEPLAY_PRESET_KEY)
  } catch {}
}

const BROWSER_NOTIFICATIONS_KEY = 'mage-web-browser-notifications'
const NOTIFICATION_ASKED_KEY = 'mage-web-notification-asked'

export function loadBrowserNotifications(): boolean {
  const parsed = readJson<unknown>(BROWSER_NOTIFICATIONS_KEY)
  if (parsed === undefined) return true
  return parsed === true
}

export function saveBrowserNotifications(enabled: boolean) {
  writeJson(BROWSER_NOTIFICATIONS_KEY, enabled)
}

export function loadNotificationAsked(): boolean {
  try {
    return getStorage().getItem(NOTIFICATION_ASKED_KEY) === '1'
  } catch {}
  return false
}

export function saveNotificationAsked() {
  try {
    getStorage().setItem(NOTIFICATION_ASKED_KEY, '1')
  } catch {}
}

const PHASE_STOPS_KEY = 'mage-web-phase-stops'
export function loadPhaseStops(): PhaseStops {
  const parsed = readJson<unknown>(PHASE_STOPS_KEY)
  if (parsed) return mergePhaseStops(parsed)
  return mergePhaseStops(null)
}

export function savePhaseStops(stops: PhaseStops) {
  writeJson(PHASE_STOPS_KEY, stops)
}

const GAME_LOG_AUTOSAVE_KEY = 'mage-web-game-log'

export function loadGameLogAutoSave(): boolean {
  const parsed = readJson<unknown>(GAME_LOG_AUTOSAVE_KEY)
  if (parsed === undefined) return true
  return parsed === true
}

export function saveGameLogAutoSave(enabled: boolean) {
  writeJson(GAME_LOG_AUTOSAVE_KEY, enabled)
}

export interface AudioSettings {
  soundEnabled: boolean
  masterVolume: number
  sfxVolume: number
  uiVolume: number
}

const AUDIO_SETTINGS_KEY = 'mage-web-audio'
export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  soundEnabled: true,
  masterVolume: 0.8,
  sfxVolume: 0.8,
  uiVolume: 0.7,
}

export function loadAudioSettings(): AudioSettings {
  const parsed = readJson<Partial<AudioSettings>>(AUDIO_SETTINGS_KEY)
  if (parsed) {
    return {
      soundEnabled: parsed.soundEnabled !== false,
      masterVolume: typeof parsed.masterVolume === 'number' ? Math.max(0, Math.min(1, parsed.masterVolume)) : DEFAULT_AUDIO_SETTINGS.masterVolume,
      sfxVolume: typeof parsed.sfxVolume === 'number' ? Math.max(0, Math.min(1, parsed.sfxVolume)) : DEFAULT_AUDIO_SETTINGS.sfxVolume,
      uiVolume: typeof parsed.uiVolume === 'number' ? Math.max(0, Math.min(1, parsed.uiVolume)) : DEFAULT_AUDIO_SETTINGS.uiVolume,
    }
  }
  return { ...DEFAULT_AUDIO_SETTINGS }
}

export function saveAudioSettings(settings: AudioSettings) {
  writeJson(AUDIO_SETTINGS_KEY, settings)
}

export interface MusicSettings {
  musicEnabled: boolean
  musicVolume: number
}

const MUSIC_SETTINGS_KEY = 'mage-web-music'
export const DEFAULT_MUSIC_SETTINGS: MusicSettings = { musicEnabled: true, musicVolume: 0.35 }

export function loadMusicSettings(): MusicSettings {
  const parsed = readJson<Partial<MusicSettings>>(MUSIC_SETTINGS_KEY)
  if (parsed) {
    return {
      musicEnabled: parsed.musicEnabled !== false,
      musicVolume: typeof parsed.musicVolume === 'number' ? Math.max(0, Math.min(1, parsed.musicVolume)) : DEFAULT_MUSIC_SETTINGS.musicVolume,
    }
  }
  return { ...DEFAULT_MUSIC_SETTINGS }
}

export function saveMusicSettings(settings: MusicSettings) {
  writeJson(MUSIC_SETTINGS_KEY, settings)
}

import { ZOOM_DEFAULT, normalizeZoom } from '../appearance/zoom'
import { normalizeCardStyle, normalizeTapStyle, type CardStyle, type TapStyle } from '../board/compactCard'

export type BoardLayoutPref = 'standard' | 'pod' | 'arena'
export type ZoomLevel = number

export interface AppearanceSettings {
  sleeveId: string
  boardLayout: BoardLayoutPref
  uiScale: ZoomLevel
  cjkBoost: boolean
  boardLayoutManual?: boolean
  playmatId?: string
  cardStyle?: CardStyle
  tapStyle?: TapStyle
  transparentDialogs?: boolean
}

const APPEARANCE_KEY = 'mage-web-appearance'
export const DEFAULT_APPEARANCE: AppearanceSettings = { sleeveId: 'classic', boardLayout: 'standard', uiScale: ZOOM_DEFAULT, cjkBoost: true, boardLayoutManual: false, transparentDialogs: false }

const VALID_LAYOUTS: BoardLayoutPref[] = ['standard', 'pod', 'arena']

export function loadAppearanceSettings(): AppearanceSettings {
  const parsed = readJson<Partial<AppearanceSettings>>(APPEARANCE_KEY)
  if (parsed) {
    const sid = typeof parsed.sleeveId === 'string' ? parsed.sleeveId : DEFAULT_APPEARANCE.sleeveId
    const layout = VALID_LAYOUTS.includes(parsed.boardLayout as BoardLayoutPref)
      ? (parsed.boardLayout as BoardLayoutPref)
      : DEFAULT_APPEARANCE.boardLayout
    const scale = normalizeZoom(parsed.uiScale)
    const cjkBoost = typeof parsed.cjkBoost === 'boolean' ? parsed.cjkBoost : DEFAULT_APPEARANCE.cjkBoost
    const playmatId = typeof parsed.playmatId === 'string' ? parsed.playmatId : undefined
    const transparentDialogs = parsed.transparentDialogs === true
    return { sleeveId: sid, boardLayout: layout, uiScale: scale, cjkBoost, boardLayoutManual: parsed.boardLayoutManual === true, cardStyle: normalizeCardStyle(parsed.cardStyle), tapStyle: normalizeTapStyle(parsed.tapStyle), transparentDialogs, ...(playmatId ? { playmatId } : null) }
  }
  return { ...DEFAULT_APPEARANCE }
}

export function saveAppearanceSettings(s: AppearanceSettings) {
  writeJson(APPEARANCE_KEY, s)
}

export function applyAppearanceToDocument(s: AppearanceSettings, lang?: string) {
  try {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    root.dataset.uiScale = String(s.uiScale)
    root.dataset.dialogBackdrop = s.transparentDialogs ? 'clear' : 'dim'
    root.style.setProperty('zoom', String(s.uiScale))
    const isCjk = lang === 'ja' || lang === 'zhs' || lang === 'zh'
    const boost = s.cjkBoost && isCjk ? 1.15 : 1
    root.style.setProperty('--cjk-boost', String(boost))
    root.dataset.cjkBoost = boost !== 1 ? '1' : '0'
    if (lang) root.lang = lang === 'zhs' ? 'zh' : lang
  } catch {}
}
