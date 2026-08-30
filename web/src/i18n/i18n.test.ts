import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { t, setLanguage, getLanguage, LANGUAGES, CARD_LANGUAGES, setCardLanguage, getCardLanguage } from './index'

describe('i18n system', () => {
  beforeEach(() => {
    setLanguage('es')
    setCardLanguage('en')
  })

  afterAll(() => {
    setLanguage('es')
    setCardLanguage('en')
  })

  it('translates basic keys in Spanish', () => {
    expect(t('common.save')).toBe('Guardar')
    expect(t('lobby.nav_tables')).toBe('Mesas')
    expect(t('game.concede')).toBe('Conceder')
  })

  it('switches to all 9 supported languages dynamically', () => {
    setLanguage('en')
    expect(getLanguage()).toBe('en')
    expect(t('common.save')).toBe('Save')

    setLanguage('de')
    expect(getLanguage()).toBe('de')
    expect(t('common.save')).toBe('Speichern')

    setLanguage('fr')
    expect(getLanguage()).toBe('fr')
    expect(t('common.save')).toBe('Enregistrer')

    setLanguage('it')
    expect(getLanguage()).toBe('it')
    expect(t('common.save')).toBe('Salva')

    setLanguage('pt')
    expect(getLanguage()).toBe('pt')
    expect(t('common.save')).toBe('Salvar')

    setLanguage('ru')
    expect(getLanguage()).toBe('ru')
    expect(t('common.save')).toBe('Сохранить')

    setLanguage('ja')
    expect(getLanguage()).toBe('ja')
    expect(t('common.save')).toBe('保存')

    setLanguage('zhs')
    expect(getLanguage()).toBe('zhs')
    expect(t('common.save')).toBe('保存')
  })

  it('supports interpolation parameters', () => {
    setLanguage('es')
    expect(t('common.search')).toBe('Buscar...')
  })

  it('manages card language settings', () => {
    expect(getCardLanguage()).toBe('en')
    setCardLanguage('ja')
    expect(getCardLanguage()).toBe('ja')
    expect(CARD_LANGUAGES.some((c) => c.code === 'ja')).toBe(true)
  })

  it('has identical length and codes between UI languages and card languages', () => {
    expect(LANGUAGES).toHaveLength(9)
    expect(CARD_LANGUAGES).toHaveLength(9)
    const uiCodes = LANGUAGES.map((l) => l.code).sort()
    const cardCodes = CARD_LANGUAGES.map((c) => c.code).sort()
    expect(uiCodes).toEqual(cardCodes)
  })
})
