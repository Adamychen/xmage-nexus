import { POPULAR_FLAGS } from './flags'

const SUPPORTED = new Set(POPULAR_FLAGS.map((f) => f.code))

const LANGUAGE_FALLBACK: Record<string, string> = {
  es: 'es',
  en: 'gb',
  de: 'de',
  fr: 'fr',
  it: 'it',
  pt: 'br',
  ja: 'jp',
}

const REGION_ALIAS: Record<string, string> = {
  uk: 'gb',
}

function readBrowserLocale(): string | null {
  try {
    if (typeof navigator === 'undefined') return null
    const lang = navigator.language
    if (typeof lang === 'string' && lang) return lang
    const langs = (navigator as Navigator & { languages?: string[] }).languages
    if (Array.isArray(langs) && typeof langs[0] === 'string' && langs[0]) return langs[0]
    return null
  } catch {
    return null
  }
}

export function guessDefaultFlag(locale?: string | null): string {
  const raw = (locale ?? readBrowserLocale() ?? '').trim()
  if (!raw) return 'world'
  const parts = raw.replace(/_/g, '-').split('-').filter(Boolean)
  if (parts.length === 0) return 'world'
  const subtags = parts.slice(1)
  for (let i = subtags.length - 1; i >= 0; i--) {
    const sub = subtags[i].toLowerCase()
    if (/^[a-z]{2}$/.test(sub)) {
      const aliased = REGION_ALIAS[sub] ?? sub
      if (SUPPORTED.has(aliased)) return aliased
      break
    }
  }
  const lang = parts[0].toLowerCase()
  const mapped = LANGUAGE_FALLBACK[lang]
  if (mapped && SUPPORTED.has(mapped)) return mapped
  return 'world'
}
