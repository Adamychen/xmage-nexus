import type { PhaseStops } from '../net/commands'
import type { DeckJson } from '../net/types'
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

export function loadConn(): ConnectionInfo | null {
  try {
    const storage = getStorage()
    const raw = storage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ConnectionInfo> & { host?: string }
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
  } catch {}
  return null
}

export function saveConn(conn: ConnectionInfo | null) {
  try {
    const storage = getStorage()
    if (conn) storage.setItem(STORAGE_KEY, JSON.stringify(conn))
    else storage.removeItem(STORAGE_KEY)
  } catch {}
}

export function loadActiveGame(): ActiveGamePersistence | null {
  try {
    const storage = getStorage()
    const raw = storage.getItem(ACTIVE_GAME_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as ActiveGamePersistence
      if (parsed && parsed.gameId && typeof parsed.savedAt === 'number') {
        if (Date.now() - parsed.savedAt < ACTIVE_GAME_MAX_AGE_MS) {
          return parsed
        }
        clearActiveGame()
      }
    }
  } catch {}
  return null
}

export function saveActiveGame(gameId: string | null, tableId?: string | null, role: 'player' | 'watcher' = 'player') {
  try {
    const storage = getStorage()
    if (gameId) {
      const data: ActiveGamePersistence = {
        gameId,
        tableId: tableId ?? null,
        role,
        savedAt: Date.now(),
      }
      storage.setItem(ACTIVE_GAME_KEY, JSON.stringify(data))
    } else {
      clearActiveGame()
    }
  } catch {}
}

export function clearActiveGame() {
  try {
    const storage = getStorage()
    storage.removeItem(ACTIVE_GAME_KEY)
  } catch {}
}

const ACTIVE_DECK_KEY = 'mage-web-active-deck'

export function saveActiveDeck(deck: DeckJson | null) {
  try {
    const storage = getStorage()
    if (deck) {
      storage.setItem(ACTIVE_DECK_KEY, JSON.stringify(deck))
    } else {
      clearActiveDeck()
    }
  } catch {}
}

export function loadActiveDeck(): DeckJson | null {
  try {
    const storage = getStorage()
    const raw = storage.getItem(ACTIVE_DECK_KEY)
    if (raw) {
      return JSON.parse(raw) as DeckJson
    }
  } catch {}
  return null
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
  try {
    const raw = getStorage().getItem(FX_SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<FxSettings>
      return {
        effects: parsed.effects !== false,
        animationSpeed: FX_SPEEDS.includes(parsed.animationSpeed as number)
          ? parsed.animationSpeed as number
          : DEFAULT_FX_SETTINGS.animationSpeed,
      }
    }
  } catch {}
  return { ...DEFAULT_FX_SETTINGS }
}

export function saveFxSettings(fx: FxSettings) {
  try {
    getStorage().setItem(FX_SETTINGS_KEY, JSON.stringify(fx))
  } catch {}
}

export interface AutoAnswerStored {
  pattern: string
  answer: boolean
}

const AUTO_ANSWERS_KEY = 'mage-web-auto-answers'

export function loadAutoAnswers(): AutoAnswerStored[] {
  try {
    const raw = getStorage().getItem(AUTO_ANSWERS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        return parsed
          .filter((entry): entry is AutoAnswerStored => {
            const record = entry as Partial<AutoAnswerStored>
            return typeof record?.pattern === 'string' && typeof record?.answer === 'boolean'
          })
          .map((entry) => ({ pattern: entry.pattern, answer: entry.answer }))
      }
    }
  } catch {}
  return []
}

export function saveAutoAnswers(rules: AutoAnswerStored[]) {
  try {
    getStorage().setItem(AUTO_ANSWERS_KEY, JSON.stringify(rules))
  } catch {}
}

export interface ChoiceMemoryStored {
  pattern: string
  value: string
}

const CHOICE_MEMORY_KEY = 'mage-web-choice-memory'

export function loadChoiceMemory(): ChoiceMemoryStored[] {
  try {
    const raw = getStorage().getItem(CHOICE_MEMORY_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        return parsed
          .filter((entry): entry is ChoiceMemoryStored => {
            const record = entry as Partial<ChoiceMemoryStored>
            return typeof record?.pattern === 'string' && typeof record?.value === 'string'
          })
          .map((entry) => ({ pattern: entry.pattern, value: entry.value }))
      }
    }
  } catch {}
  return []
}

export function saveChoiceMemory(rules: ChoiceMemoryStored[]) {
  try {
    getStorage().setItem(CHOICE_MEMORY_KEY, JSON.stringify(rules))
  } catch {}
}

export interface ManaPaymentStored {
  auto: boolean
  restricted: boolean
  useFirstAbility: boolean
  confirmEmptyPool: boolean
}

const MANA_PAYMENT_KEY = 'mage-web-mana-payment'
export const DEFAULT_MANA_PAYMENT: ManaPaymentStored = {
  auto: true,
  restricted: true,
  useFirstAbility: false,
  confirmEmptyPool: true,
}

export function loadManaPayment(): ManaPaymentStored {
  try {
    const raw = getStorage().getItem(MANA_PAYMENT_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ManaPaymentStored>
      return {
        auto: typeof parsed.auto === 'boolean' ? parsed.auto : DEFAULT_MANA_PAYMENT.auto,
        restricted: typeof parsed.restricted === 'boolean' ? parsed.restricted : DEFAULT_MANA_PAYMENT.restricted,
        useFirstAbility:
          typeof parsed.useFirstAbility === 'boolean' ? parsed.useFirstAbility : DEFAULT_MANA_PAYMENT.useFirstAbility,
        confirmEmptyPool:
          typeof parsed.confirmEmptyPool === 'boolean'
            ? parsed.confirmEmptyPool
            : DEFAULT_MANA_PAYMENT.confirmEmptyPool,
      }
    }
  } catch {}
  return { ...DEFAULT_MANA_PAYMENT }
}

export function saveManaPayment(mana: ManaPaymentStored) {
  try {
    getStorage().setItem(MANA_PAYMENT_KEY, JSON.stringify(mana))
  } catch {}
}

const HAND_REQUESTS_KEY = 'mage-web-hand-requests'

export function loadHandRequestsAllowed(): boolean {
  try {
    const raw = getStorage().getItem(HAND_REQUESTS_KEY)
    if (raw != null) return JSON.parse(raw) === true
  } catch {}
  return true
}

export function saveHandRequestsAllowed(allowed: boolean) {
  try {
    getStorage().setItem(HAND_REQUESTS_KEY, JSON.stringify(allowed))
  } catch {}
}

const PHASE_STOPS_KEY = 'mage-web-phase-stops'
export function loadPhaseStops(): PhaseStops {
  try {
    const raw = getStorage().getItem(PHASE_STOPS_KEY)
    if (raw) return mergePhaseStops(JSON.parse(raw))
  } catch {}
  return mergePhaseStops(null)
}

export function savePhaseStops(stops: PhaseStops) {
  try {
    getStorage().setItem(PHASE_STOPS_KEY, JSON.stringify(stops))
  } catch {}
}

const GAME_LOG_AUTOSAVE_KEY = 'mage-web-game-log'

export function loadGameLogAutoSave(): boolean {
  try {
    const raw = getStorage().getItem(GAME_LOG_AUTOSAVE_KEY)
    if (raw != null) return JSON.parse(raw) === true
  } catch {}
  return true
}

export function saveGameLogAutoSave(enabled: boolean) {
  try {
    getStorage().setItem(GAME_LOG_AUTOSAVE_KEY, JSON.stringify(enabled))
  } catch {}
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
  try {
    const raw = getStorage().getItem(AUDIO_SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AudioSettings>
      return {
        soundEnabled: parsed.soundEnabled !== false,
        masterVolume: typeof parsed.masterVolume === 'number' ? Math.max(0, Math.min(1, parsed.masterVolume)) : DEFAULT_AUDIO_SETTINGS.masterVolume,
        sfxVolume: typeof parsed.sfxVolume === 'number' ? Math.max(0, Math.min(1, parsed.sfxVolume)) : DEFAULT_AUDIO_SETTINGS.sfxVolume,
        uiVolume: typeof parsed.uiVolume === 'number' ? Math.max(0, Math.min(1, parsed.uiVolume)) : DEFAULT_AUDIO_SETTINGS.uiVolume,
      }
    }
  } catch {}
  return { ...DEFAULT_AUDIO_SETTINGS }
}

export function saveAudioSettings(settings: AudioSettings) {
  try {
    getStorage().setItem(AUDIO_SETTINGS_KEY, JSON.stringify(settings))
  } catch {}
}

import { ZOOM_DEFAULT, normalizeZoom } from '../appearance/zoom'

export type BoardLayoutPref = 'standard' | 'pod' | 'arena'
export type ZoomLevel = number

export interface AppearanceSettings {
  sleeveId: string
  boardLayout: BoardLayoutPref
  uiScale: ZoomLevel
  cjkBoost: boolean
}

const APPEARANCE_KEY = 'mage-web-appearance'
export const DEFAULT_APPEARANCE: AppearanceSettings = { sleeveId: 'classic', boardLayout: 'standard', uiScale: ZOOM_DEFAULT, cjkBoost: true }

const VALID_LAYOUTS: BoardLayoutPref[] = ['standard', 'pod', 'arena']

export function loadAppearanceSettings(): AppearanceSettings {
  try {
    const raw = getStorage().getItem(APPEARANCE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppearanceSettings>
      const sid = typeof parsed.sleeveId === 'string' ? parsed.sleeveId : DEFAULT_APPEARANCE.sleeveId
      const layout = VALID_LAYOUTS.includes(parsed.boardLayout as BoardLayoutPref)
        ? (parsed.boardLayout as BoardLayoutPref)
        : DEFAULT_APPEARANCE.boardLayout
      const scale = normalizeZoom(parsed.uiScale)
      const cjkBoost = typeof parsed.cjkBoost === 'boolean' ? parsed.cjkBoost : DEFAULT_APPEARANCE.cjkBoost
      return { sleeveId: sid, boardLayout: layout, uiScale: scale, cjkBoost }
    }
  } catch {}
  return { ...DEFAULT_APPEARANCE }
}

export function saveAppearanceSettings(s: AppearanceSettings) {
  try {
    getStorage().setItem(APPEARANCE_KEY, JSON.stringify(s))
  } catch {}
}

export function applyAppearanceToDocument(s: AppearanceSettings, lang?: string) {
  try {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    root.dataset.uiScale = String(s.uiScale)
    root.style.setProperty('zoom', String(s.uiScale))
    const isCjk = lang === 'ja' || lang === 'zhs' || lang === 'zh'
    const boost = s.cjkBoost && isCjk ? 1.15 : 1
    root.style.setProperty('--cjk-boost', String(boost))
    root.dataset.cjkBoost = boost !== 1 ? '1' : '0'
    if (lang) root.lang = lang === 'zhs' ? 'zh' : lang
  } catch {}
}
