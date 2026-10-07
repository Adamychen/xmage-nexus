import { t } from '../i18n'

export type ServerPreset = 'local' | 'official' | 'xdhs' | 'custom'

const FLAG_CODES = [
  'es', 'us', 'mx', 'ar', 'cl', 'co', 'de', 'fr', 'gb', 'it', 'jp', 'br', 'ca', 'au',
  'at', 'be', 'bg', 'bo', 'by', 'ch', 'cn', 'cr', 'cu', 'cz', 'dk', 'do', 'ec', 'ee',
  'eg', 'fi', 'gr', 'gt', 'hk', 'hn', 'hr', 'hu', 'id', 'ie', 'il', 'in', 'is', 'kr',
  'kz', 'lt', 'lu', 'lv', 'ma', 'my', 'ng', 'ni', 'nl', 'no', 'nz', 'pa', 'pe', 'ph',
  'pk', 'pl', 'pr', 'pt', 'py', 'ro', 'rs', 'ru', 'sa', 'se', 'sg', 'si', 'sk', 'sv',
  'th', 'tr', 'tw', 'ua', 'uy', 've', 'vn', 'za',
]

function flagEmoji(code: string): string {
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

export const POPULAR_FLAGS = [
  { code: 'world', emoji: '🌐' },
  ...FLAG_CODES.map((code) => ({ code, emoji: flagEmoji(code) })),
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

const sortedFlagsCache: Record<string, typeof POPULAR_FLAGS> = {}

export function sortedFlags(lang: string): typeof POPULAR_FLAGS {
  const cacheKey = lang.toLowerCase()
  if (sortedFlagsCache[cacheKey]) return sortedFlagsCache[cacheKey]
  let collator: Intl.Collator
  try {
    collator = new Intl.Collator([lang, 'en'])
  } catch {
    collator = new Intl.Collator('en')
  }
  const [world, ...countries] = POPULAR_FLAGS
  const sorted = [
    world,
    ...countries
      .map((f) => ({ f, name: countryName(f.code, lang) }))
      .sort((a, b) => collator.compare(a.name, b.name))
      .map(({ f }) => f),
  ]
  sortedFlagsCache[cacheKey] = sorted
  return sorted
}
