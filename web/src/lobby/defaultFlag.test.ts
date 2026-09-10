import { describe, expect, it } from 'vitest'
import { guessDefaultFlag } from './defaultFlag'

describe('guessDefaultFlag', () => {
  it('uses the region when it is a supported flag', () => {
    expect(guessDefaultFlag('es-MX')).toBe('mx')
    expect(guessDefaultFlag('en-US')).toBe('us')
    expect(guessDefaultFlag('es-AR')).toBe('ar')
    expect(guessDefaultFlag('es-CL')).toBe('cl')
    expect(guessDefaultFlag('es-CO')).toBe('co')
    expect(guessDefaultFlag('pt-BR')).toBe('br')
    expect(guessDefaultFlag('en-CA')).toBe('ca')
    expect(guessDefaultFlag('fr-CA')).toBe('ca')
    expect(guessDefaultFlag('en-AU')).toBe('au')
    expect(guessDefaultFlag('de-DE')).toBe('de')
  })

  it('aliases the UK region to the gb flag', () => {
    expect(guessDefaultFlag('en-GB')).toBe('gb')
    expect(guessDefaultFlag('en-UK')).toBe('gb')
  })

  it('falls back to the language when bare or the region is unsupported', () => {
    expect(guessDefaultFlag('de')).toBe('de')
    expect(guessDefaultFlag('fr')).toBe('fr')
    expect(guessDefaultFlag('it')).toBe('it')
    expect(guessDefaultFlag('es')).toBe('es')
    expect(guessDefaultFlag('en')).toBe('gb')
    expect(guessDefaultFlag('pt')).toBe('br')
    expect(guessDefaultFlag('ja')).toBe('jp')
    expect(guessDefaultFlag('en-IE')).toBe('gb')
    expect(guessDefaultFlag('de-AT')).toBe('de')
  })

  it('handles underscore separators and casing', () => {
    expect(guessDefaultFlag('es_MX')).toBe('mx')
    expect(guessDefaultFlag('en_US')).toBe('us')
    expect(guessDefaultFlag('ES-mx')).toBe('mx')
    expect(guessDefaultFlag('EN-us')).toBe('us')
  })

  it('returns world for unmapped languages, empty or missing locales', () => {
    expect(guessDefaultFlag('xx-YY')).toBe('world')
    expect(guessDefaultFlag('ru')).toBe('world')
    expect(guessDefaultFlag('ru-RU')).toBe('world')
    expect(guessDefaultFlag('zh-CN')).toBe('world')
    expect(guessDefaultFlag('zh')).toBe('world')
    expect(guessDefaultFlag('nl')).toBe('world')
    expect(guessDefaultFlag('')).toBe('world')
  })

  it('falls back to the browser locale when passed null', () => {
    const prev = window.navigator.language
    Object.defineProperty(window.navigator, 'language', { value: 'xx-YY', configurable: true })
    try {
      expect(guessDefaultFlag(null)).toBe('world')
    } finally {
      Object.defineProperty(window.navigator, 'language', { value: prev, configurable: true })
    }
  })

  it('treats bare ca as Catalan (world), not Canada', () => {
    expect(guessDefaultFlag('ca')).toBe('world')
  })

  it('reads the browser locale when no argument is given', () => {
    const prev = window.navigator.language
    Object.defineProperty(window.navigator, 'language', { value: 'de-DE', configurable: true })
    try {
      expect(guessDefaultFlag()).toBe('de')
    } finally {
      Object.defineProperty(window.navigator, 'language', { value: prev, configurable: true })
    }
  })
})
