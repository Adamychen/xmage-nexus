import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

function loadGenerated() {
  const file = path.resolve(process.cwd(), 'public', 'splash-i18n.js')
  const code = fs.readFileSync(file, 'utf8')
  const sandbox: Record<string, unknown> = {}
  new Function('window', code)(sandbox)
  return sandbox as {
    __SPLASH_I18N: Record<string, Record<string, string>>
    __SPLASH_PICK_LANG: (raw: string) => string
  }
}

describe('splash-i18n generated bundle', () => {
  it('covers the 9 app languages with identical keys and placeholders', () => {
    const { __SPLASH_I18N: L } = loadGenerated()
    expect(Object.keys(L).sort()).toEqual(
      ['de', 'en', 'es', 'fr', 'it', 'ja', 'pt', 'ru', 'zhs'].sort(),
    )
    const base = Object.keys(L.en)
    expect(base.length).toBeGreaterThan(15)
    for (const [lang, dict] of Object.entries(L)) {
      expect(Object.keys(dict), `${lang} keys`).toEqual(base)
      for (const key of ['downloading', 'verifying', 'extracting']) {
        expect(dict[key], `${lang}.${key}`).toContain('{component}')
      }
      expect(dict.step, `${lang}.step`).toContain('{n}')
      expect(dict.step, `${lang}.step`).toContain('{total}')
      expect(dict.err_update_failed, `${lang}.err_update_failed`).toContain('{detail}')
      for (const v of Object.values(dict)) expect(v, `${lang} empty`).not.toBe('')
    }
  })

  it('picks the right language with English fallback', () => {
    const { __SPLASH_PICK_LANG: pick } = loadGenerated()
    expect(pick('es-ES')).toBe('es')
    expect(pick('pt-BR')).toBe('pt')
    expect(pick('zh-CN')).toBe('zhs')
    expect(pick('zh_TW')).toBe('zhs')
    expect(pick('ja-JP')).toBe('ja')
    expect(pick('de')).toBe('de')
    expect(pick('ca')).toBe('en')
    expect(pick('nl')).toBe('en')
    expect(pick('')).toBe('en')
  })
})
