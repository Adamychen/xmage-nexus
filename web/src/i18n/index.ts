import { useSyncExternalStore, useCallback } from 'react'
import type { SupportedLanguage, LanguageInfo, TranslationSchema } from './types'
import { es } from './locales/es'
import { en } from './locales/en'
import { de } from './locales/de'
import { fr } from './locales/fr'
import { ja } from './locales/ja'
import { it } from './locales/it'
import { pt } from './locales/pt'
import { ru } from './locales/ru'
import { zhs } from './locales/zhs'

export * from './types'

export const LANGUAGES: LanguageInfo[] = [
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'zhs', name: '简体中文', flag: '🇨🇳' },
]

export const CARD_LANGUAGES: Array<{ code: string; name: string; flag: string }> = [
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'zhs', name: '简体中文', flag: '🇨🇳' },
]

const LOCALES: Record<SupportedLanguage, TranslationSchema> = {
  es,
  en,
  de,
  fr,
  ja,
  it,
  pt,
  ru,
  zhs,
}

const STORAGE_KEY_LANG = 'nexus_lang'
const STORAGE_KEY_CARD_LANG = 'nexus_card_lang'

function getInitialLanguage(): SupportedLanguage {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_LANG) as SupportedLanguage | null
    if (saved && LOCALES[saved]) return saved

    const browserLang = navigator.language.slice(0, 2).toLowerCase()
    if (browserLang in LOCALES) return browserLang as SupportedLanguage
  } catch {}
  return 'es'
}

function getInitialCardLanguage(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CARD_LANG)
    if (saved) return saved
  } catch {}
  return 'en'
}

let currentLanguage: SupportedLanguage = getInitialLanguage()
let currentCardLanguage: string = getInitialCardLanguage()
let storeVersion = 0
const listeners = new Set<() => void>()

function notifyListeners() {
  storeVersion++
  listeners.forEach((fn) => fn())
}

export function getLanguage(): SupportedLanguage {
  return currentLanguage
}

export function setLanguage(lang: SupportedLanguage): void {
  if (LOCALES[lang] && lang !== currentLanguage) {
    currentLanguage = lang
    try {
      localStorage.setItem(STORAGE_KEY_LANG, lang)
    } catch {}
    notifyListeners()
  }
}

export function getCardLanguage(): string {
  return currentCardLanguage
}

export function setCardLanguage(langCode: string): void {
  if (langCode !== currentCardLanguage) {
    currentCardLanguage = langCode
    try {
      localStorage.setItem(STORAGE_KEY_CARD_LANG, langCode)
    } catch {}
    notifyListeners()
  }
}

function subscribe(callback: () => void) {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

function getStoreSnapshot(): string {
  return `${currentLanguage}:${currentCardLanguage}:${storeVersion}`
}

/**
 * Type-safe string translation path accessor.
 * Supports both t('game', 'concede') and t('game.concede') formats.
 */
export function t<K1 extends keyof TranslationSchema, K2 extends keyof TranslationSchema[K1]>(
  category: K1,
  key: K2,
  params?: Record<string, string | number>,
): string
export function t(path: string, params?: Record<string, string | number>): string
export function t(
  pathOrCat: string,
  keyOrParams?: string | Record<string, string | number>,
  params?: Record<string, string | number>,
): string {
  let path = pathOrCat
  let effectiveParams = params

  if (typeof keyOrParams === 'string') {
    path = `${pathOrCat}.${keyOrParams}`
  } else if (typeof keyOrParams === 'object' && keyOrParams !== null) {
    effectiveParams = keyOrParams
  }

  const parts = path.split('.')
  let current: any = LOCALES[currentLanguage] || LOCALES.es

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part]
    } else {
      // Fallback to Spanish or key if missing
      let fallback: any = LOCALES.es
      for (const p of parts) {
        if (fallback && typeof fallback === 'object' && p in fallback) {
          fallback = fallback[p]
        } else {
          return path
        }
      }
      current = fallback
      break
    }
  }

  if (typeof current !== 'string') return path

  if (effectiveParams) {
    let text = current
    for (const [k, v] of Object.entries(effectiveParams)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
    }
    return text
  }

  return current
}

/**
 * Automatically translates known backend/gateway error phrases or keys to the active language.
 */
export function translateError(error: string | null | undefined): string {
  if (!error) return ''
  const str = String(error).trim()
  const lower = str.toLowerCase()

  if (lower.includes('login fallido') || lower.includes('login failed') || lower.includes('invalid username or password') || lower.includes('can\'t receive server state')) {
    return t('errors.login_failed')
  }
  if (lower.includes('no se pudo conectar al proxy') || lower.includes('failed to connect to proxy') || lower.includes('unable to connect') || lower.includes('websocket')) {
    return t('errors.proxy_connection_failed')
  }
  if (lower.includes('table full') || lower.includes('mesa llena') || lower.includes('full table')) {
    return t('errors.table_full')
  }
  if (lower.includes('table not found') || lower.includes('mesa no encontrada') || lower.includes('no existe')) {
    return t('errors.table_not_found')
  }
  if (lower.includes('invalid password') || lower.includes('password incorrect') || lower.includes('contraseña incorrecta')) {
    return t('errors.invalid_password')
  }
  if (lower.includes('timeout') || lower.includes('tiempo de espera agotado')) {
    return t('errors.timeout')
  }
  if (lower.includes('no se pudo crear la mesa') || lower.includes('failed to create table')) {
    return t('errors.create_table_failed')
  }
  if (lower.includes('no se pudo unir') || lower.includes('failed to join') || lower.includes('rechazó la unión')) {
    return t('errors.join_table_failed')
  }
  if (lower.includes('debes indicar al menos un set') || lower.includes('at least one set')) {
    return t('errors.draft_no_sets')
  }
  if (lower.includes('no se pudieron reconocer cartas') || lower.includes('could not recognize cards')) {
    return t('errors.deck_parse_failed')
  }
  if (lower.includes('no se pudo leer el archivo') || lower.includes('could not read')) {
    return t('errors.deck_read_failed')
  }

  // If path exists in translations (e.g. 'errors.create_table_failed')
  if (str.startsWith('errors.')) {
    return t(str)
  }

  return str
}

export function useTranslation() {
  useSyncExternalStore(subscribe, getStoreSnapshot, getStoreSnapshot)

  const changeLanguage = useCallback((newLang: SupportedLanguage) => {
    setLanguage(newLang)
  }, [])

  const changeCardLanguage = useCallback((newCardLang: string) => {
    setCardLanguage(newCardLang)
  }, [])

  const translate: typeof t = useCallback((pathOrCat: any, keyOrParams?: any, params?: any) => {
    return t(pathOrCat, keyOrParams, params)
  }, [])

  const errorTranslator = useCallback((err: string | null | undefined) => {
    return translateError(err)
  }, [])

  return {
    t: translate,
    tError: errorTranslator,
    lang: currentLanguage,
    cardLang: currentCardLanguage,
    setLanguage: changeLanguage,
    setCardLanguage: changeCardLanguage,
    languages: LANGUAGES,
    cardLanguages: CARD_LANGUAGES,
  }
}
