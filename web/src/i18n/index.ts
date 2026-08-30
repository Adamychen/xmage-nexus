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
 * Example: t('common.save') or t('game.concede')
 */
export function t(path: string, params?: Record<string, string | number>): string {
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

  if (params) {
    let text = current
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
    }
    return text
  }

  return current
}

export function useTranslation() {
  useSyncExternalStore(subscribe, getStoreSnapshot, getStoreSnapshot)

  const changeLanguage = useCallback((newLang: SupportedLanguage) => {
    setLanguage(newLang)
  }, [])

  const changeCardLanguage = useCallback((newCardLang: string) => {
    setCardLanguage(newCardLang)
  }, [])

  const translate = useCallback((path: string, params?: Record<string, string | number>) => {
    return t(path, params)
  }, [])

  return {
    t: translate,
    lang: currentLanguage,
    cardLang: currentCardLanguage,
    setLanguage: changeLanguage,
    setCardLanguage: changeCardLanguage,
    languages: LANGUAGES,
    cardLanguages: CARD_LANGUAGES,
  }
}
