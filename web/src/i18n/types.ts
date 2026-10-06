import type { en } from './locales/en'

export type SupportedLanguage = 'es' | 'en' | 'de' | 'fr' | 'ja' | 'it' | 'pt' | 'ru' | 'zhs'

export interface LanguageInfo {
  code: SupportedLanguage
  name: string
  flag: string
}

export type TranslationSchema = Omit<typeof en, 'keywords'> & { keywords: Record<string, string> }

/** The `t` of `useTranslation`, narrowed to one category: for helpers that take `t` as a parameter. */
export type CategoryT<C extends keyof TranslationSchema> = (
  category: C,
  key: keyof TranslationSchema[C],
  params?: Record<string, string | number>,
) => string
