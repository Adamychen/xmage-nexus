import { describe, it, expect, beforeEach } from 'vitest'
import { t, setLanguage, getLanguage, LANGUAGES, CARD_LANGUAGES, setCardLanguage, getCardLanguage } from './index'

describe('i18n system', () => {
  beforeEach(() => {
    setLanguage('es')
    setCardLanguage('es')
  })

  it('translates basic keys in Spanish', () => {
    expect(t('common.save')).toBe('Guardar')
    expect(t('lobby.nav_tables')).toBe('Mesas')
    expect(t('game.concede')).toBe('Conceder')
  })

  it('switches languages dynamically', () => {
    setLanguage('en')
    expect(getLanguage()).toBe('en')
    expect(t('common.save')).toBe('Save')
    expect(t('lobby.nav_tables')).toBe('Tables')
    expect(t('game.concede')).toBe('Concede')

    setLanguage('de')
    expect(getLanguage()).toBe('de')
    expect(t('common.save')).toBe('Speichern')

    setLanguage('fr')
    expect(getLanguage()).toBe('fr')
    expect(t('common.save')).toBe('Enregistrer')

    setLanguage('ja')
    expect(getLanguage()).toBe('ja')
    expect(t('common.save')).toBe('保存')
  })

  it('supports interpolation parameters', () => {
    setLanguage('es')
    expect(t('common.search')).toBe('Buscar...')
  })

  it('manages card language settings', () => {
    expect(getCardLanguage()).toBe('es')
    setCardLanguage('ja')
    expect(getCardLanguage()).toBe('ja')
    expect(CARD_LANGUAGES.some((c) => c.code === 'ja')).toBe(true)
  })

  it('provides comprehensive language list', () => {
    expect(LANGUAGES.length).toBeGreaterThanOrEqual(5)
    expect(LANGUAGES.some((l) => l.code === 'es')).toBe(true)
    expect(LANGUAGES.some((l) => l.code === 'en')).toBe(true)
  })
})
