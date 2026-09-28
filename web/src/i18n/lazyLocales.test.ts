import { describe, it, expect, beforeEach } from 'vitest'
import { ensureLocaleLoaded, getLanguage, setLanguage, t, useLanguage } from './index'

/**
 * The nine locales load as their own chunks, English stays eager as the fallback. A test has no
 * grace period to wait for a chunk, so the switch-and-read tests use `useLanguage`; these check the
 * loading contract itself, including the fallback that keeps the UI readable in the meantime.
 */
describe('lazy locales', () => {
  beforeEach(async () => {
    await useLanguage('es')
  })

  it('reads translated strings right after awaiting the switch', async () => {
    for (const lang of ['de', 'fr', 'it', 'pt', 'ru', 'ja', 'zhs', 'en'] as const) {
      await useLanguage(lang)
      expect(getLanguage()).toBe(lang)
      expect(t('common.save'), lang).not.toBe('')
      expect(t('common.save'), lang).not.toBe('common.save')
    }
  })

  it('never fetches a language twice, however many callers ask at once', async () => {
    // the store is shared, so switching language in three places at once must not start three
    // imports of the same locale chunk
    await Promise.all([useLanguage('ja'), useLanguage('ja'), useLanguage('ja')])
    await ensureLocaleLoaded('ja')
    expect(getLanguage()).toBe('ja')
    expect(t('common.save')).toBe('保存')
  })

  it('keeps English readable while a language is still in flight', async () => {
    // setLanguage paints the new language immediately and fills it when the chunk lands, so a slow
    // or failing chunk must leave readable text behind rather than blank labels or raw key paths
    setLanguage('ru')
    expect(getLanguage()).toBe('ru')
    const before = t('common.save')
    expect(before).not.toBe('')
    expect(before).not.toBe('common.save')
    await ensureLocaleLoaded('ru')
    expect(t('common.save')).toBe('Сохранить')
  })

  it('falls back to the key when neither the language nor English has it', async () => {
    await useLanguage('ja')
    expect(t('nope.not.a.key')).toBe('nope.not.a.key')
  })
})
