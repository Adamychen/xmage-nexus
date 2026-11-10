// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB = fileURLToPath(new URL('../..', import.meta.url))
const read = (path: string) => readFileSync(join(WEB, path), 'utf8')
const FONT_HOST = /https?:\/\/fonts\.(?:googleapis|gstatic)\.com/
const BUNDLED = ['Cinzel', 'Merriweather']

function webSources(): string[] {
  const src = (readdirSync(join(WEB, 'src'), { recursive: true, encoding: 'utf8' }) as string[])
    .filter((f) => /\.(css|ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f))
    .map((f) => join('src', f))
  const pages = readdirSync(join(WEB, 'public')).filter((f) => f.endsWith('.html')).map((f) => join('public', f))
  return ['index.html', ...pages, ...src]
}

function importedFaceSheets(): string[] {
  return [...read('src/system/webFonts.css').matchAll(/@import\s+'([^']+)'/g)].map((m) =>
    join(WEB, 'node_modules', m[1]),
  )
}

describe('fonts served by the app', () => {
  it('APR-5: no page, stylesheet or script asks a third-party host for a font', () => {
    const offenders = webSources().filter((file) => FONT_HOST.test(read(file)))
    const externalLinks = [...read('index.html').matchAll(/<link\b[^>]*\bhref="(https?:[^"]+)"/g)].map((m) => m[1])
    const remoteFaces = webSources().flatMap((file) =>
      [...read(file).matchAll(/@font-face\s*{[^}]*}/g)]
        .filter((m) => /url\(\s*['"]?(?:https?:|\/\/)/.test(m[0]))
        .map(() => file),
    )
    expect(offenders).toEqual([])
    expect(externalLinks).toEqual([])
    expect(remoteFaces).toEqual([])
  })

  it('APR-5: Cinzel and Merriweather come from bundled woff2 files, sliced by unicode-range', () => {
    expect(read('src/main.tsx')).toContain("import './system/webFonts.css'")
    const sheets = importedFaceSheets()
    expect(sheets.length).toBeGreaterThan(0)
    const families = new Set<string>()
    for (const sheet of sheets) {
      const faces = [...readFileSync(sheet, 'utf8').matchAll(/@font-face\s*{([^}]*)}/g)].map((m) => m[1])
      expect(faces.length, sheet).toBeGreaterThan(0)
      for (const face of faces) {
        families.add(/font-family:\s*'([^']+)'/.exec(face)?.[1] ?? '')
        expect(face).toMatch(/font-display:\s*swap/)
        expect(face).toMatch(/unicode-range:/)
        const urls = [...face.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1])
        expect(urls.some((u) => u.endsWith('.woff2'))).toBe(true)
        for (const url of urls) {
          expect(url).toMatch(/^\.\//)
          expect(existsSync(join(dirname(sheet), url)), url).toBe(true)
        }
      }
    }
    expect([...families].sort()).toEqual(BUNDLED)
    const display = /--font-display:\s*([^;]+);/.exec(read('src/styles.css'))?.[1] ?? ''
    for (const family of BUNDLED) expect(display).toContain(`'${family}'`)
  })

  it('APR-5: the build never inlines a font as a data: URL', async () => {
    const { default: config } = await import('../../vite.config')
    const limit = (typeof config === 'function' ? config({ command: 'build', mode: 'production' }) : config).build
      ?.assetsInlineLimit
    expect(typeof limit).toBe('function')
    const inline = limit as (file: string, content: Buffer) => boolean | undefined
    for (const file of ['a.woff2', 'a.woff', 'a.ttf', 'a.otf']) expect(inline(file, Buffer.alloc(10))).toBe(false)
    expect(inline('a.svg', Buffer.alloc(10))).toBeUndefined()
  })

  it('APR-5: the desktop CSP allows no font host either', () => {
    const conf = JSON.parse(read('../launcher/src-tauri/tauri.conf.json')) as { app: { security: { csp: string } } }
    const directive = (name: string) =>
      conf.app.security.csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? ''
    expect(directive('font-src')).toBe("font-src 'self' data:")
    expect(directive('style-src')).toBe("style-src 'self' 'unsafe-inline'")
  })
})
