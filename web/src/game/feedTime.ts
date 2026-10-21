import { toBcp47Locale, type SupportedLanguage } from '../i18n'

export function formatFeedTime(time: number, lang: SupportedLanguage): string {
  try {
    return new Date(time).toLocaleTimeString(toBcp47Locale(lang), { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return ''
  }
}
