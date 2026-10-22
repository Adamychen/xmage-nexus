import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from './locales/en'
import { switchLanguage, t, translateError } from './index'

const loads = vi.hoisted(() => ({ fr: 0 }))

vi.mock('./locales/fr', () => {
  loads.fr++
  throw new Error('chunk failed to load')
})

function stubStorage(initial: Record<string, string> = {}) {
  const memory: Record<string, string> = { ...initial }
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => memory[key] ?? null,
    setItem: (key: string, value: string) => { memory[key] = value },
    removeItem: (key: string) => { delete memory[key] },
    clear: () => { for (const k of Object.keys(memory)) delete memory[k] },
    key: (index: number) => Object.keys(memory)[index] ?? null,
    get length() { return Object.keys(memory).length },
  })
}

describe('t() interpolation', () => {
  beforeEach(async () => {
    await switchLanguage('en')
  })

  it("keeps $' and $& in a value literally", () => {
    expect(t('game', 'feed_attack_one', { player: "$'" })).toBe("$' attacks with 1 creature")
    expect(t('game', 'feed_attack_one', { player: '$&' })).toBe('$& attacks with 1 creature')
  })

  it('does not replace a placeholder that appears inside a value', () => {
    expect(t('game', 'feed_lose_life_one', { player: '{amount}', amount: 3 })).toBe('{amount} loses 3 life (-3)')
    expect(t('game', 'feed_lose_life_one', { amount: 3, player: '{amount}' })).toBe('{amount} loses 3 life (-3)')
  })

  it('leaves a placeholder without a matching param untouched', () => {
    expect(t('game', 'feed_lose_life_one', { player: 'Ann' })).toBe('Ann loses {amount} life (-{amount})')
  })
})

describe('translateError action prefix', () => {
  beforeEach(async () => {
    await switchLanguage('en')
  })

  it('uses the create-table prefix for a card-not-found during createTable', () => {
    expect(translateError('card not found', 'createTable')).toBe(`${t('errors.create_table_failed')}: card not found`)
  })

  it('uses the join prefix for a card-not-found during joinTable', () => {
    expect(translateError('card not found', 'joinTable')).toBe(`${t('errors.join_table_failed')}: card not found`)
  })
})

describe('language stored by a tampered or failing session', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('a saved inherited key such as constructor falls back to English and never throws', async () => {
    for (const saved of ['constructor', '__proto__', 'toString']) {
      stubStorage({ nexus_lang: saved })
      vi.resetModules()
      const m = await import('./index')
      expect(() => m.preloadInitialLocale(), saved).not.toThrow()
      expect(m.getLanguage(), saved).toBe('en')
      expect(m.t('common.save'), saved).toBe(en.common.save)
      vi.unstubAllGlobals()
    }
  })

  it('a locale chunk that fails to load reverts to English and a re-selection retries it', async () => {
    stubStorage()
    vi.resetModules()
    const m = await import('./index')
    await m.switchLanguage('en')
    loads.fr = 0
    m.setLanguage('fr')
    await m.ensureLocaleLoaded('fr')
    expect(m.getLanguage()).toBe('en')
    expect(m.t('common.save')).toBe(en.common.save)
    m.setLanguage('fr')
    await m.ensureLocaleLoaded('fr')
    expect(loads.fr).toBe(2)
  })
})
