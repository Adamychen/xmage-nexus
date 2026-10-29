import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { dismissSetupWizard } from './support/start-game'
import { richCommanderGame, showGame } from './support/rich-game'

fakeOnly()

type Rec = Record<string, unknown>

type Layout = 'standard' | 'pod' | 'arena' | 'table'
type Size = 'small' | 'medium' | 'large'
type Style = 'classic' | 'compact'

const LAYOUT_SETTINGS: Record<Layout, Rec> = {
  standard: { gameUi: 'v1', boardLayout: 'standard', boardLayoutManual: true },
  pod: { gameUi: 'v1', boardLayout: 'pod', boardLayoutManual: true },
  arena: { gameUi: 'v1', boardLayout: 'arena', boardLayoutManual: true },
  table: { gameUi: 'v2', boardLayout: 'arena', boardLayoutManual: true },
}

const BOARD_SELECTOR = '[data-testid$="-board"]'

const SIZES: Record<Size, { walkers: number; creatures: number; lands: number; treasures: number; saga: boolean; rock: boolean }> = {
  small: { walkers: 1, creatures: 3, lands: 5, treasures: 0, saga: false, rock: false },
  medium: { walkers: 1, creatures: 6, lands: 7, treasures: 3, saga: true, rock: true },
  large: { walkers: 3, creatures: 10, lands: 12, treasures: 6, saga: false, rock: false },
}

const VIEWPORTS = [
  { width: 1100, height: 700 },
  { width: 1366, height: 768 },
  { width: 1366, height: 900 },
  { width: 1600, height: 900 },
  { width: 1920, height: 1080 },
]

const SETTLE_MS = 900
const WINDOW_MS = 1000
const MAX_CHANGES = 2

function perm(id: string, name: string, types: string[], extra: Rec = {}): Rec {
  return { id, parentId: id, name, displayName: name, cardTypes: types, manaValue: 3, expansionSetCode: '', cardNumber: '0', ...extra }
}

function token(id: string, name: string, types: string[]): Rec {
  return { ...perm(id, name, types, { manaValue: 0 }), isToken: true, mageObjectType: 'TOKEN' }
}

function sizedBattlefield(owner: string, size: Size): Record<string, Rec> {
  const spec = SIZES[size]
  const cards: Rec[] = []
  for (let i = 0; i < spec.walkers; i++) cards.push(perm(`${owner}-walker${i}`, `Jace ${i}`, ['PLANESWALKER'], { loyalty: '3' }))
  if (spec.saga) cards.push(perm(`${owner}-saga`, 'Saga of Ancient Lore', ['ENCHANTMENT', 'SAGA']))
  if (spec.rock) cards.push(perm(`${owner}-rock`, 'Sol Ring', ['ARTIFACT']))
  for (let i = 0; i < spec.treasures; i++) cards.push(token(`${owner}-treasure${i}`, 'Treasure', ['ARTIFACT']))
  for (let i = 0; i < spec.creatures; i++) {
    const attachments = size === 'large' && i === 0 ? [`${owner}-aura`] : []
    cards.push(perm(`${owner}-bear${i}`, `Bear ${i}`, ['CREATURE'], { power: '2', toughness: '2', attachments }))
  }
  if (size === 'large') cards.push(perm(`${owner}-aura`, 'Pacifism', ['ENCHANTMENT']))
  for (let i = 0; i < spec.lands; i++) {
    cards.push(perm(`${owner}-land${i}`, ['Forest', 'Island', 'Swamp', 'Mountain', 'Plains'][i % 5], ['LAND'], { manaValue: 0 }))
  }
  return Object.fromEntries(cards.map((card) => [String(card.id), card]))
}

function sizedGame(seats: number, size: Size): Rec {
  const game = richCommanderGame() as { players: Rec[] }
  const players = game.players.slice(0, seats).map((player, index) =>
    index < 2 ? { ...player, battlefield: sizedBattlefield(String(player.playerId).replace('p-', ''), size) } : player,
  )
  return { ...game, players }
}

async function settledChanges(page: Page, selector: string): Promise<number> {
  await page.waitForTimeout(SETTLE_MS)
  return page.evaluate<number, { selector: string; windowMs: number }>(
    ({ selector, windowMs }: { selector: string; windowMs: number }) =>
      new Promise<number>((resolve) => {
        const board = document.querySelector(selector)
        if (!board) {
          resolve(-1)
          return
        }
        let changes = 0
        const mo = new MutationObserver((records) => {
          for (const record of records) {
            if (record.attributeName !== 'style' && record.attributeName !== 'data-band-lines') continue
            if ((record.target as Element).closest('.flying-cards-overlay')) continue
            changes++
          }
        })
        mo.observe(board, { attributes: true, subtree: true, attributeFilter: ['style', 'data-band-lines'] })
        setTimeout(() => {
          mo.disconnect()
          resolve(changes)
        }, windowMs)
      }),
    { selector, windowMs: WINDOW_MS },
  )
}

function describeCase(layout: Layout, seats: number, style: Style, size: Size, viewport: { width: number; height: number }): string {
  return `layout=${layout} seats=${seats} size=${size} style=${style} viewport=${viewport.width}x${viewport.height}`
}

const LAYOUTS = Object.keys(LAYOUT_SETTINGS) as Layout[]
const SEAT_COUNTS = [2, 4]
const STYLES: Style[] = ['classic', 'compact']

for (const layout of LAYOUTS) {
  for (const seats of SEAT_COUNTS) {
    for (const style of STYLES) {
      test(`BRD-21: the ${layout} board with ${seats} seats and ${style} cards keeps every size once drawn`, async ({ page }) => {
        test.setTimeout(180_000)
        await page.goto('/')
        await dismissSetupWizard(page)
        await page.waitForTimeout(300)

        const violations: string[] = []
        for (const size of Object.keys(SIZES) as Size[]) {
          for (const viewport of VIEWPORTS) {
            await page.setViewportSize(viewport)
            await showGame(page, sizedGame(seats, size), { ...LAYOUT_SETTINGS[layout], cardStyle: style })
            await expect(page.locator(BOARD_SELECTOR).first()).toBeVisible({ timeout: 10_000 })
            const changes = await settledChanges(page, BOARD_SELECTOR)
            if (changes < 0 || changes > MAX_CHANGES) {
              violations.push(`${describeCase(layout, seats, style, size, viewport)}: ${changes} size changes after settle (max ${MAX_CHANGES})`)
            }
          }
        }
        expect(violations, 'board size changes after it settled').toEqual([])
      })
    }
  }
}
