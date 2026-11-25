import { describe, it, expect, afterEach } from 'vitest'
import { keywordDisplayName, keywordQualities, keywordSummary, keywordRuleRef, localizeKeywordParam } from './keywordI18n'
import { setLanguage, switchLanguage, t } from '../i18n'

const stub = (entries: Record<string, string>) => (key: string) => entries[key] ?? `keywords.${key}`

describe('keywordI18n', () => {
  afterEach(() => {
    setLanguage('es')
  })

  it('replaces {param} in name templates and trims when missing', () => {
    const lookup = stub({ ward_name: 'Rebatir {param}' })
    expect(keywordDisplayName('ward', 'Ward', lookup, '{2}')).toBe('Rebatir {2}')
    expect(keywordDisplayName('ward', 'Ward', lookup)).toBe('Rebatir')
  })

  it('keeps templates without placeholder untouched and falls back to EN', () => {
    const lookup = stub({ flying_name: 'Volar' })
    expect(keywordDisplayName('flying', 'Flying', lookup, '{3}')).toBe('Volar')
    expect(keywordDisplayName('unknown_kw', 'Weird', lookup)).toBe('Weird')
    expect(keywordDisplayName('unknown_kw', 'Weird', lookup, '{3}')).toBe('Weird {3}')
  })

  it('resolves summaries with {param} defaulting to N', () => {
    const lookup = stub({ toxic_summary: 'Obtienen {param} contadores.' })
    expect(keywordSummary('toxic', lookup, '2')).toBe('Obtienen 2 contadores.')
    expect(keywordSummary('toxic', lookup)).toBe('Obtienen N contadores.')
    expect(keywordSummary('missing', lookup, undefined, 'fb')).toBe('fb')
  })

  it('maps generic rule snippets to localized wiki keys', () => {
    const lookup = (path: string) => ({ 'wiki.rule_official': 'Regla oficial.', 'wiki.rule_ability_word': 'Palabra oficial.' })[path] ?? path
    expect(keywordRuleRef('Regla oficial de MTG.', lookup)).toBe('Regla oficial.')
    expect(keywordRuleRef('Palabra de Habilidad oficial de MTG.', lookup)).toBe('Palabra oficial.')
    expect(keywordRuleRef('CR 701.18: Scry', lookup)).toBe('CR 701.18: Scry')
    expect(keywordRuleRef(undefined, lookup)).toBeUndefined()
  })

  it('CRD-8: a parameter that names several qualities is read as a list, not as one name', () => {
    expect(keywordQualities('black and from green')).toEqual(['black', 'green'])
    expect(keywordQualities('white, blue and from red')).toEqual(['white', 'blue', 'red'])
    expect(keywordQualities('black')).toEqual(['black'])
    expect(keywordQualities('{2}')).toEqual(['{2}'])
  })

  it('CRD-8: every quality of the parameter is translated, and the rest is left as the engine wrote it', () => {
    const lookup = stub({ quality_black: 'negro', quality_green: 'verde', quality_and: 'y' })
    expect(localizeKeywordParam('black and from green', lookup)).toBe('negro y verde')
    expect(localizeKeywordParam('Dragons', lookup)).toBe('Dragons')
    expect(localizeKeywordParam('{2}', lookup)).toBe('{2}')
    expect(localizeKeywordParam(undefined, lookup)).toBeUndefined()
  })

  it('CRD-8: a conjunction written without letters joins without spaces around it', () => {
    const lookup = stub({ quality_black: '黒', quality_green: '緑', quality_and: 'と' })
    expect(localizeKeywordParam('black and from green', lookup)).toBe('黒と緑')
  })

  it('CRD-8: the name and the summary of a keyword carry the translated qualities', async () => {
    const kw = (k: string) => t('keywords', k)
    setLanguage('es')
    expect(keywordDisplayName('protection', 'Protection from black and from green', kw, 'black and from green'))
      .toBe('Protección contra negro y verde')
    expect(keywordSummary('protection', kw, 'black and from green')).toContain('negro y verde')
    await switchLanguage('en')
    expect(keywordDisplayName('protection', 'Protection', kw, 'black and from green'))
      .toBe('Protection from black and green')
  })

  it('reads real locales through t() per active language', async () => {
    const kw = (k: string) => t('keywords', k)
    await switchLanguage('de')
    expect(keywordDisplayName('flying', 'Flying', kw)).toBe('Fliegend')
    expect(keywordDisplayName('ward', 'Ward', kw, '{2}')).toBe('Abwehr {2}')
    setLanguage('es')
    expect(keywordDisplayName('flying', 'Flying', kw)).toBe('Volar')
    expect(keywordDisplayName('ward', 'Ward', kw, '{2}')).toBe('Rebatir {2}')
    await switchLanguage('en')
    expect(keywordDisplayName('flying', 'Flying', kw)).toBe('Flying')
    await switchLanguage('ja')
    expect(keywordSummary('toxic', kw, '1')).toContain('毒カウンター')
  })
})
