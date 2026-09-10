import { describe, it, expect } from 'vitest'
import { countryName, POPULAR_FLAGS } from './flags'

describe('countryName (localized flag labels)', () => {
  it('translates country codes via Intl.DisplayNames', () => {
    expect(countryName('us', 'en')).toBe('United States')
    expect(countryName('us', 'es')).toBe('Estados Unidos')
    expect(countryName('us', 'ja')).toBe('アメリカ合衆国')
    expect(countryName('gb', 'de')).toBe('Vereinigtes Königreich')
    expect(countryName('gb', 'en')).toBe('United Kingdom')
    expect(countryName('es', 'it')).toBe('Spagna')
  })

  it('caches DisplayNames per language (same result repeated)', () => {
    expect(countryName('ar', 'fr')).toBe('Argentine')
    expect(countryName('ar', 'fr')).toBe('Argentine')
  })

  it('degrades gracefully for unknown codes', () => {
    const label = countryName('zz', 'en')
    expect(typeof label).toBe('string')
    expect(label.trim()).not.toBe('')
  })

  it('resolves the world entry through i18n', () => {
    const label = countryName('world', 'en')
    expect(typeof label).toBe('string')
    expect(label.length).toBeGreaterThan(0)
    expect(label).not.toBe('world')
  })

  it('every popular flag has a non-empty name for each UI language', () => {
    const langs = ['es', 'en', 'de', 'fr', 'it', 'pt', 'ru', 'ja', 'zhs']
    for (const f of POPULAR_FLAGS) {
      for (const lang of langs) {
        expect(countryName(f.code, lang).trim()).not.toBe('')
      }
    }
  })
})
