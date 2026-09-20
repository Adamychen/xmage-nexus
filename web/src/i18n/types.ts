import type { en } from './locales/en'

export type SupportedLanguage = 'es' | 'en' | 'de' | 'fr' | 'ja' | 'it' | 'pt' | 'ru' | 'zhs'

export interface LanguageInfo {
  code: SupportedLanguage
  name: string
  flag: string
}

export type TranslationSchema = Omit<typeof en, 'keywords'> & { keywords: Record<string, string> }
