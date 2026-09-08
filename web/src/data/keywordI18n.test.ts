import { describe, it, expect, afterEach } from 'vitest'
import { keywordDisplayName, keywordSummary, keywordRuleRef } from './keywordI18n'
import { setLanguage, t } from '../i18n'

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

  it('reads real locales through t() per active language', () => {
    const kw = (k: string) => t('keywords', k)
    setLanguage('de')
    expect(keywordDisplayName('flying', 'Flying', kw)).toBe('Fliegend')
    expect(keywordDisplayName('ward', 'Ward', kw, '{2}')).toBe('Abwehr {2}')
    setLanguage('es')
    expect(keywordDisplayName('flying', 'Flying', kw)).toBe('Volar')
    expect(keywordDisplayName('ward', 'Ward', kw, '{2}')).toBe('Rebatir {2}')
    setLanguage('en')
    expect(keywordDisplayName('flying', 'Flying', kw)).toBe('Flying')
    setLanguage('ja')
    expect(keywordSummary('toxic', kw, '1')).toContain('毒カウンター')
  })
})
