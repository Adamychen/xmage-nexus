import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() { return data.size },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => { data.delete(k) },
    setItem: (k, v) => { data.set(k, String(v)) },
  }
}

async function freshModules() {
  vi.resetModules()
  const i18n = await import('../i18n')
  const localization = await import('./cardLocalization')
  return { ...i18n, getEffectiveCardLang: localization.getEffectiveCardLang }
}

describe('card language', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()))
  afterEach(() => vi.unstubAllGlobals())

  it('CRD-6: English picked as card language stays English with a Spanish interface', async () => {
    localStorage.setItem('nexus_lang', 'es')
    localStorage.setItem('nexus_card_lang', 'en')
    const { getCardLanguage, getEffectiveCardLang } = await freshModules()
    expect(getCardLanguage()).toBe('en')
    expect(getEffectiveCardLang()).toBe('en')
  })

  it('CRD-6: until the player picks one, cards are English as the picker shows, whatever the interface', async () => {
    localStorage.setItem('nexus_lang', 'es')
    const { getCardLanguage, getEffectiveCardLang, setLanguage } = await freshModules()
    expect(getCardLanguage()).toBe('en')
    expect(getEffectiveCardLang()).toBe('en')
    setLanguage('fr')
    expect(getEffectiveCardLang()).toBe('en')
  })

  it('CRD-6: a language other than English picked for cards is used over the interface', async () => {
    localStorage.setItem('nexus_lang', 'es')
    localStorage.setItem('nexus_card_lang', 'de')
    const { getEffectiveCardLang } = await freshModules()
    expect(getEffectiveCardLang()).toBe('de')
  })

  it('CRD-6: going back to English with the selector is remembered and wins over the interface', async () => {
    localStorage.setItem('nexus_lang', 'es')
    const first = await freshModules()
    first.setCardLanguage('es')
    expect(first.getEffectiveCardLang()).toBe('es')
    first.setCardLanguage('en')
    expect(first.getEffectiveCardLang()).toBe('en')
    expect(localStorage.getItem('nexus_card_lang')).toBe('en')
    const reloaded = await freshModules()
    expect(reloaded.getEffectiveCardLang()).toBe('en')
  })
})
