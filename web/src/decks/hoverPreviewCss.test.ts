// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = fileURLToPath(new URL('..', import.meta.url))
const OWNER = 'decks/DeckHoverPreview.css'
const PREVIEW_SELECTOR = /\.(?:arena-floating-preview|preview-face-card|preview-face-label)\b|@keyframes\s+arena-preview-pop\b/

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return cssFiles(full)
    return name.endsWith('.css') ? [full] : []
  })
}

describe('hover preview stylesheet', () => {
  it('DCK-3: only DeckHoverPreview.css styles the hover preview', () => {
    const owners = cssFiles(SRC)
      .filter((file) => PREVIEW_SELECTOR.test(readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')))
      .map((file) => relative(SRC, file).split('\\').join('/'))
    expect(owners).toEqual([OWNER])
  })

  it('DCK-3: the preview image is never narrower than its frame', () => {
    const css = readFileSync(join(SRC, OWNER), 'utf8')
    const imgRule = css.match(/\.preview-face-card img\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(imgRule).toMatch(/width:\s*100%/)
    expect(imgRule).toMatch(/max-width:\s*none/)
  })
})
