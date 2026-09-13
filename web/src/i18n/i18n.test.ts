import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { t, translateError, setLanguage, getLanguage, LANGUAGES, CARD_LANGUAGES, setCardLanguage, getCardLanguage, toBcp47Locale } from './index'
import { ja } from './locales/ja'

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

  it('translates error messages and raw server phrases across languages', () => {
    setLanguage('es')
    expect(translateError('login failed')).toBe('Error de inicio de sesión: credenciales incorrectas o servidor no disponible')
    expect(translateError('table full')).toBe('La mesa ya está completa')

    setLanguage('en')
    expect(translateError('login failed')).toBe('Login failed: invalid credentials or server unavailable')
    expect(translateError('table full')).toBe('This table is already full')

    setLanguage('de')
    expect(translateError('login failed')).toBe('Anmeldung fehlgeschlagen: Ungültige Anmeldedaten oder Server nicht erreichbar')

    setLanguage('ja')
    expect(translateError('login failed')).toBe('ログイン失敗: 認証情報が無効か、サーバーが利用できません')
  })

  it('falls back to English (not Spanish) for keys missing in the active language', () => {
    const backup = ja.game.concede
    try {
      setLanguage('ja')
      delete (ja.game as unknown as Record<string, unknown>).concede
      expect(t('game.concede')).toBe('Concede')
      expect(t('game', 'concede')).toBe('Concede')
    } finally {
      ;(ja.game as unknown as Record<string, unknown>).concede = backup
      setLanguage('es')
    }
  })

  it('maps game language to BCP-47 for Intl formatters', () => {
    expect(toBcp47Locale('zhs')).toBe('zh')
    expect(toBcp47Locale('ja')).toBe('ja')
    expect(toBcp47Locale('es')).toBe('es')
    expect(toBcp47Locale('en')).toBe('en')
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

  it('exposes the B.10/C.13 keys in all 9 languages with working interpolation', () => {
    const keys = [
      'game.spectator_game_changed',
      'game.follow_game',
      'lobby.join_remember_default',
      'lobby.invite_cancelled_stay',
      'lobby.invite_searching',
      'decks.export_backup_count',
      'decks.import_backup_json',
    ]
    for (const lang of LANGUAGES) {
      setLanguage(lang.code)
      for (const key of keys) {
        const value = t(key)
        expect(value, `${lang.code}:${key}`).not.toBe('')
        expect(value, `${lang.code}:${key}`).not.toBe(key)
      }
    }
    setLanguage('es')
    expect(t('decks.export_backup_count', { count: 3 })).toContain('3')
    expect(t('lobby.invite_searching', { current: 1, total: 10 })).toContain('1')
    expect(t('lobby.invite_searching', { current: 1, total: 10 })).toContain('10')
  })

  it('falls back to English for the new keys when missing in the active language', () => {
    const backup = ja.game.follow_game
    try {
      setLanguage('ja')
      delete (ja.game as unknown as Record<string, unknown>).follow_game
      expect(t('game.follow_game')).toBe('Follow game')
      expect(t('game', 'follow_game')).toBe('Follow game')
    } finally {
      ;(ja.game as unknown as Record<string, unknown>).follow_game = backup
      setLanguage('es')
    }
  })
})
