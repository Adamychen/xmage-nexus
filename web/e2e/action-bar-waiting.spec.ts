import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { dismissSetupWizard } from './support/start-game'
import { richCommanderGame, showGame } from './support/rich-game'
import { de } from '../src/i18n/locales/de'
import { en } from '../src/i18n/locales/en'
import { es } from '../src/i18n/locales/es'
import { fr } from '../src/i18n/locales/fr'
import { it as itLocale } from '../src/i18n/locales/it'
import { ja } from '../src/i18n/locales/ja'
import { pt } from '../src/i18n/locales/pt'
import { ru } from '../src/i18n/locales/ru'
import { zhs } from '../src/i18n/locales/zhs'

fakeOnly()

const V1 = { gameUi: 'v1', boardLayout: 'arena', boardLayoutManual: true }
const LOCALES = { en, es, de, fr, it: itLocale, pt, ru, ja, zhs }
const NAMES = ['BlackMagicWxyz', 'WWWWWWWWWWWWWW', 'Ana']
const VIEWPORTS = [
  { label: 'desktop', width: 1600, height: 900 },
  { label: 'phone', width: 390, height: 844 },
]

function waitingFor(name: string): Record<string, unknown> {
  const game = richCommanderGame() as { players: Array<Record<string, unknown>>; priorityPlayerName: string }
  game.players.find((p) => p.controlled)!.hasPriority = false
  const mira = game.players.find((p) => p.playerId === 'p-mira')!
  mira.name = name
  mira.hasPriority = true
  mira.priorityTimeLeftSecs = 433
  game.priorityPlayerName = name
  return game
}

async function pillLayout(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const btn = document.querySelector<HTMLElement>('.action-button-container .big-action-btn')!
    const label = btn.querySelector<HTMLElement>('.action-btn-label')!
    const clock = btn.querySelector<HTMLElement>('.action-waiting-clock')!
    const icon = btn.querySelector<HTMLElement>('.action-btn-icon')!
    const name = btn.querySelector<HTMLElement>('.action-btn-name')
    const toggle = document.querySelector<HTMLElement>('.action-button-container .big-action-toggle')!
    const b = btn.getBoundingClientRect()
    const lineCount = (rects: DOMRect[]) => {
      const sorted = rects.filter((r) => r.width > 0 && r.height > 0).sort((a, z) => a.top - z.top)
      let lines = 0
      let bottom = -Infinity
      for (const r of sorted) {
        if (r.top >= bottom - 1) lines++
        bottom = Math.max(bottom, r.bottom)
      }
      return lines
    }
    const linesOf = (el: Element) => {
      const range = document.createRange()
      range.selectNodeContents(el)
      return lineCount([...range.getClientRects()])
    }
    const broken: string[] = []
    const pastEdge: string[] = []
    const walker = document.createTreeWalker(btn, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const parent = n.parentElement!
      if (getComputedStyle(parent).display === 'none') continue
      const clippedByName = name?.contains(parent) ?? false
      for (const m of (n.textContent ?? '').matchAll(/\S+/g)) {
        const range = document.createRange()
        range.setStart(n, m.index!)
        range.setEnd(n, m.index! + m[0].length)
        const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0)
        if (rects.length === 0) continue
        if (lineCount(rects) > 1 && !/[　-鿿]/.test(m[0])) broken.push(m[0])
        const right = clippedByName ? Math.min(...rects.map((r) => r.right), name!.getBoundingClientRect().right) : Math.max(...rects.map((r) => r.right))
        if (right > b.right + 0.5) pastEdge.push(m[0])
      }
    }
    const l = label.getBoundingClientRect()
    const c = clock.getBoundingClientRect()
    const i = icon.getBoundingClientRect()
    const t = toggle.getBoundingClientRect()
    const glyph = document.createRange()
    glyph.selectNodeContents(toggle)
    const g = glyph.getBoundingClientRect()
    const parts = [...clock.querySelectorAll('.action-waiting-thinking, .action-waiting-left')]
    return {
      labelLines: linesOf(label),
      broken,
      pastEdge,
      nameCut: name ? name.scrollWidth > name.clientWidth + 1 : false,
      nameEllipsis: name ? getComputedStyle(name).textOverflow : '',
      clockOffset: Math.abs(c.left - l.left),
      iconBeforeText: i.right <= l.left,
      iconOffCentre: Math.abs((i.top + i.bottom) / 2 - (l.top + c.bottom) / 2),
      clockPartsSplit: parts.filter((p) => linesOf(p) > 1).map((p) => p.textContent),
      toggleTop: Math.abs(t.top - b.top),
      toggleHeight: Math.abs(t.height - b.height),
      glyphOffCentre: Math.abs((g.top + g.bottom) / 2 - (t.top + t.bottom) / 2),
      title: btn.title,
    }
  })
}

for (const vp of VIEWPORTS) {
  test.describe(`waiting pill on the ${vp.label}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })

    for (const [lang, locale] of Object.entries(LOCALES)) {
      test(`BRD-29: the classic bar's waiting pill keeps its text, clock and arrow aligned (${lang}, ${vp.width}px) @gameui`, async ({ page }) => {
        await page.addInitScript((l) => localStorage.setItem('nexus_lang', l), lang)
        await page.goto('/')
        await dismissSetupWizard(page)
        const prefix = locale.game.waiting_for.split('{name}')[0].trim()
        for (const name of NAMES) {
          await showGame(page, waitingFor(name), V1)
          const pill = page.locator('.action-button-container .big-action-btn.action-waiting')
          await expect(pill).toBeVisible({ timeout: 10_000 })
          await expect(pill.locator('.action-btn-label')).toContainText(prefix)
          await expect(pill.locator('.action-btn-name')).toHaveText(name)
          await expect(pill.locator('.action-waiting-left')).toBeVisible()
          await page.waitForTimeout(150)
          const fit = await pillLayout(page)
          const at = `${name} (${lang}, ${vp.width}px)`
          expect(fit.title, at).toContain(name)
          expect(fit.labelLines, `label on one or two lines: ${at}`).toBeLessThanOrEqual(2)
          expect(fit.broken, `no word broken across lines: ${at}`).toEqual([])
          expect(fit.pastEdge, `no text past the pill: ${at}`).toEqual([])
          if (fit.nameCut) expect(fit.nameEllipsis, `a cut name ends in an ellipsis: ${at}`).toBe('ellipsis')
          expect(fit.clockOffset, `clock starts where the label starts: ${at}`).toBeLessThanOrEqual(1)
          expect(fit.iconBeforeText, `hourglass left of the text: ${at}`).toBe(true)
          expect(fit.iconOffCentre, `hourglass centred on the text block: ${at}`).toBeLessThanOrEqual(1.5)
          expect(fit.clockPartsSplit, `"thinking" and "left" each stay on one line: ${at}`).toEqual([])
          expect(fit.toggleTop, `arrow box starts with the pill: ${at}`).toBeLessThanOrEqual(0.5)
          expect(fit.toggleHeight, `arrow box as tall as the pill: ${at}`).toBeLessThanOrEqual(0.5)
          expect(fit.glyphOffCentre, `arrow centred in its box: ${at}`).toBeLessThanOrEqual(1.5)
        }
      })
    }
  })
}
