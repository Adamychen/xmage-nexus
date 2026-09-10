import { describe, expect, it, vi, afterEach } from 'vitest'

describe('default language', () => {
  afterEach(() => {
    try {
      window.localStorage.setItem('nexus_lang', 'es')
    } catch {}
    vi.unstubAllGlobals()
  })

  it('defaults to English without saved preference or matching browser language', async () => {
    try {
      window.localStorage.removeItem('nexus_lang')
    } catch {}
    Object.defineProperty(window.navigator, 'language', { value: 'xx-YY', configurable: true })
    vi.resetModules()
    const m = await import('./index')
    expect(m.getLanguage()).toBe('en')
  })
})
