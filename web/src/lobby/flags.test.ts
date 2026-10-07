import { describe, it, expect } from 'vitest'
import { countryName, POPULAR_FLAGS, sortedFlags } from './flags'

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

  it('sorts flags alphabetically by localized name, keeping world first', () => {
    for (const lang of ['en', 'es', 'de']) {
      const flags = sortedFlags(lang)
      expect(flags).toHaveLength(POPULAR_FLAGS.length)
      expect(flags[0].code).toBe('world')
      const names = flags.slice(1).map((f) => countryName(f.code, lang))
      const collator = new Intl.Collator([lang, 'en'])
      expect(names).toEqual([...names].sort(collator.compare))
    }
    const en = sortedFlags('en').map((f) => f.code)
    expect(en.slice(1, 4)).toEqual(['ar', 'au', 'at'])
  })
})
