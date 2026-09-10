import { t } from '../i18n'

export type ServerPreset = 'local' | 'official' | 'custom'

export const POPULAR_FLAGS = [
  { code: 'world', emoji: '🌐' },
  { code: 'es', emoji: '🇪🇸' },
  { code: 'us', emoji: '🇺🇸' },
  { code: 'mx', emoji: '🇲🇽' },
  { code: 'ar', emoji: '🇦🇷' },
  { code: 'cl', emoji: '🇨🇱' },
  { code: 'co', emoji: '🇨🇴' },
  { code: 'de', emoji: '🇩🇪' },
  { code: 'fr', emoji: '🇫🇷' },
  { code: 'gb', emoji: '🇬🇧' },
  { code: 'it', emoji: '🇮🇹' },
  { code: 'jp', emoji: '🇯🇵' },
  { code: 'br', emoji: '🇧🇷' },
  { code: 'ca', emoji: '🇨🇦' },
  { code: 'au', emoji: '🇦🇺' },
]

let displayNamesCache: Record<string, Intl.DisplayNames> = {}

function regionName(code: string, lang: string): string {
  const upper = code.toUpperCase()
  try {
    const cacheKey = lang.toLowerCase()
    if (!displayNamesCache[cacheKey]) {
      displayNamesCache[cacheKey] = new Intl.DisplayNames([lang, 'en'], { type: 'region' })
    }
    return displayNamesCache[cacheKey].of(upper) ?? upper
  } catch {
    return upper
  }
}

export function countryName(code: string, lang: string): string {
  if (code === 'world') return t('login', 'world')
  return regionName(code, lang)
}
