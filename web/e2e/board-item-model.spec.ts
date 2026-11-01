import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { dismissSetupWizard } from './support/start-game'
import { richCommanderGame, showGame } from './support/rich-game'
import { itemModel, type ItemKind, type ItemOpts } from '../src/board/layout/itemModel'

fakeOnly()

type Rec = Record<string, unknown>

const WIDTHS = [100, 160]
const TOLERANCE_PX = 1
const PROBE_STYLE_ID = 'brd28-card-width'

interface Measured {
  label: string
  kind: ItemKind
  footprint: number
}

function perm(id: string, name: string, types: string[], extra: Rec = {}): Rec {
  return { id, parentId: id, name, displayName: name, cardTypes: types, manaValue: 2, expansionSetCode: '', cardNumber: '0', ...extra }
}

function token(id: string, name: string): Rec {
  return { ...perm(id, name, ['ARTIFACT'], { manaValue: 0 }), isToken: true, mageObjectType: 'TOKEN' }
}

function commander(id: string, name: string, manaValue: number): Rec {
  return { id, name, mageObjectType: 'COMMANDER', cardTypes: ['CREATURE'], manaValue, rules: ['<b>Commander</b>'] }
}

function emblem(id: string, name: string): Rec {
  return { id, name, mageObjectType: 'EMBLEM', cardTypes: ['EMBLEM'], manaValue: 0, rules: ['Emblem text.'] }
}

function plane(id: string, name: string): Rec {
  return { id, name, mageObjectType: 'PLANE', cardTypes: ['PLANE'], manaValue: 0, rules: ['Planar text.'] }
}

function ownBattlefield(): Record<string, Rec> {
  const creature = { power: '2', toughness: '2' }
  const cards: Rec[] = [
    perm('bear-u', 'Bear Untapped', ['CREATURE'], creature),
    perm('bear-t', 'Bear Tapped', ['CREATURE'], { ...creature, tapped: true }),
    perm('bear-a1', 'Bear With Aura', ['CREATURE'], { ...creature, attachments: ['aura-1'] }),
    perm('bear-a1t', 'Tapped Bear With Aura', ['CREATURE'], { ...creature, tapped: true, attachments: ['aura-2'] }),
    perm('bear-a2', 'Bear With Two Auras', ['CREATURE'], { ...creature, attachments: ['aura-3', 'aura-4'] }),
    perm('mutant', 'Mutant', ['CREATURE'], {
      ...creature,
      mutated: true,
      mutateView: { cards: { 'mutant-p1': perm('mutant-p1', 'Mutant Part One', ['CREATURE']), 'mutant-p2': perm('mutant-p2', 'Mutant Part Two', ['CREATURE']) } },
    }),
    perm('aura-1', 'Rancor', ['ENCHANTMENT']),
    perm('aura-2', 'Pacifism', ['ENCHANTMENT']),
    perm('aura-3', 'Journey to Nowhere', ['ENCHANTMENT']),
    perm('aura-4', 'Ghostly Prison', ['ENCHANTMENT']),
  ]
  const lands: [string, number, number][] = [
    ['Forest', 3, 0],
    ['Island', 4, 0],
    ['Swamp', 5, 0],
    ['Mountain', 3, 3],
    ['Plains', 4, 4],
    ['Tundra', 5, 5],
  ]
  for (const [name, count, tapped] of lands) {
    for (let i = 0; i < count; i++) cards.push(perm(`land-${name}-${i}`, name, ['LAND'], { manaValue: 0, tapped: i < tapped }))
  }
  const tokens: [string, number, number][] = [
    ['Treasure', 3, 0],
    ['Clue', 5, 0],
    ['Food', 4, 4],
    ['Blood', 3, 3],
  ]
  for (const [name, count, tapped] of tokens) {
    for (let i = 0; i < count; i++) cards.push({ ...token(`token-${name}-${i}`, name), tapped: i < tapped })
  }
  return Object.fromEntries(cards.map((card) => [String(card.id), card]))
}

function boardGame(seats: number): Rec {
  const base = richCommanderGame() as { players: Rec[] }
  const [adam, mira, tobias, ilse] = base.players
  const players = [
    {
      ...adam,
      battlefield: ownBattlefield(),
      commandList: [
        commander('cmd-adam', 'Korvold, Fae-Cursed King', 5),
        emblem('emblem-adam-1', 'Emblem - The Ring'),
        emblem('emblem-adam-2', 'Emblem - Elspeth'),
        plane('plane-adam', 'Plane - Ravnica'),
      ],
    },
    {
      ...mira,
      battlefield: {},
      commandList: [commander('cmd-mira-1', 'Yuriko, the Tiger’s Shadow', 2), commander('cmd-mira-2', 'Second Commander', 4), emblem('emblem-mira', 'Emblem - Mira')],
    },
    tobias,
    ilse,
  ].slice(0, seats)
  return { ...base, players }
}

async function showBoard(page: Page, game: Rec, settings: Rec): Promise<void> {
  await page.goto('/')
  await dismissSetupWizard(page)
  await showGame(page, game, settings)
  await expect(page.locator('.bz-band').first()).toBeVisible({ timeout: 10_000 })
}

async function setCardWidth(page: Page, px: number): Promise<void> {
  await page.evaluate(
    ({ px, id }) => {
      let style = document.getElementById(id) as HTMLStyleElement | null
      if (!style) {
        style = document.createElement('style')
        style.id = id
        document.head.appendChild(style)
      }
      style.textContent = `.board-zone .bz-band, .board-zone .bz-commander { --card-w: ${px}px !important; }`
    },
    { px, id: PROBE_STYLE_ID },
  )
  for (let frame = 0; frame < 200; frame++) {
    const busy = await page.evaluate(
      () =>
        new Promise<number>((resolve) =>
          requestAnimationFrame(() =>
            resolve(
              document.getAnimations().filter((a) => {
                const end = a.effect?.getComputedTiming().endTime
                return a.playState === 'running' && typeof end === 'number' && Number.isFinite(end)
              }).length,
            ),
          ),
        ),
    )
    if (busy === 0 && frame > 1) return
  }
}

async function measure(page: Page): Promise<Measured[]> {
  return page.evaluate(() => {
    const footprint = (el: HTMLElement): number => {
      const cs = getComputedStyle(el)
      return el.offsetWidth + (parseFloat(cs.marginLeft) || 0) + (parseFloat(cs.marginRight) || 0)
    }
    const isTapped = (el: Element) => el.classList.contains('tapped')
    const items = [
      ...document.querySelectorAll<HTMLElement>('.bz-band > *'),
      ...document.querySelectorAll<HTMLElement>('.bz-commander > .command-zone'),
    ]
    const out: { label: string; kind: unknown; footprint: number }[] = []
    for (const el of items) {
      if (el.matches('.command-zone')) {
        const slots = el.querySelectorAll('.commander-slot').length
        out.push({
          label: `commander x${slots}`,
          kind: {
            kind: 'commander',
            commanders: slots,
            compactPod: el.classList.contains('compact'),
            planes: el.querySelectorAll(':scope > .plane-slot').length,
            emblems: el.querySelectorAll(':scope > .emblems-wrap > .emblem-slot').length,
          },
          footprint: footprint(el),
        })
      } else if (el.matches('.stack-group')) {
        const cards = [...el.querySelectorAll<HTMLElement>(':scope > .card-slot')]
        out.push({
          label: `${cards[0]?.dataset.cardName ?? '?'} pile of ${cards.length}`,
          kind: {
            kind: 'pile',
            pile: el.classList.contains('land-group') ? 'land' : 'token',
            count: cards.length,
            tapped: cards.filter(isTapped).length,
          },
          footprint: footprint(el),
        })
      } else if (el.matches('.card-attachment-group, .card-mutate-pile')) {
        const host = el.querySelector<HTMLElement>(':scope > .card-slot')
        out.push({
          label: `${host?.dataset.cardName ?? '?'} with attachments`,
          kind: {
            kind: 'card',
            tapped: host ? isTapped(host) : false,
            attachments: el.querySelectorAll(':scope > .attachments-list > .attachment-subcard').length,
            mutateParts: el.querySelectorAll(':scope > .mutate-parts > .mutate-part').length,
          },
          footprint: footprint(el),
        })
      } else if (el.matches('.card-slot')) {
        out.push({
          label: el.dataset.cardName ?? '?',
          kind: { kind: 'card', tapped: isTapped(el), attachments: 0, mutateParts: 0 },
          footprint: footprint(el),
        })
      } else {
        out.push({ label: `unclassified ${el.className}`, kind: { kind: 'unknown' }, footprint: footprint(el) })
      }
    }
    return out as unknown as Measured[]
  })
}

function predicted(item: ItemKind, opts: ItemOpts, c: number): number {
  const model = itemModel(item, opts)
  return model.a * c + model.b
}

const card = (tapped: boolean, attachments: number, mutateParts = 0): ItemKind => ({ kind: 'card', tapped, attachments, mutateParts })
const pile = (pileKind: 'land' | 'token', count: number, tapped: number): ItemKind => ({ kind: 'pile', pile: pileKind, count, tapped })
const commandZone = (commanders: number, compactPod: boolean, planes = 0, emblems = 0): ItemKind => ({ kind: 'commander', commanders, compactPod, planes, emblems })

const BOARD_KINDS: ItemKind[] = [
  card(false, 0),
  card(true, 0),
  card(false, 1),
  card(true, 1),
  card(false, 2),
  card(false, 0, 2),
  pile('land', 3, 0),
  pile('land', 4, 0),
  pile('land', 5, 0),
  pile('land', 3, 3),
  pile('land', 4, 4),
  pile('land', 5, 5),
  pile('token', 3, 0),
  pile('token', 5, 0),
  pile('token', 4, 4),
  pile('token', 3, 3),
]

const sortedJson = (items: ItemKind[]) => items.map((item) => JSON.stringify(item)).sort()

const STYLE_CASES = [
  { cardStyle: 'classic', tapStyle: 'upright' },
  { cardStyle: 'classic', tapStyle: 'tilted' },
  { cardStyle: 'compact', tapStyle: 'upright' },
  { cardStyle: 'compact', tapStyle: 'tilted' },
] as const

for (const { cardStyle, tapStyle } of STYLE_CASES) {
  const compact = cardStyle === 'compact'
  const tilted = tapStyle === 'tilted'
  const title = `${cardStyle} cards with ${tapStyle} tapped cards`
  test(`BRD-28: ${title}: every battlefield item and command zone is as wide as itemModel predicts`, async ({ page }) => {
    const settings = { gameUi: 'v1', boardLayout: 'standard', boardLayoutManual: true, cardStyle, tapStyle }
    await showBoard(page, boardGame(2), settings)
    await expect(page.locator('.board-zone.card-style-compact')).toHaveCount(compact ? 2 : 0)
    await expect(page.locator('.board-zone.tap-tilted')).toHaveCount(tilted ? 2 : 0)

    const opts: ItemOpts = { compact, tilted }
    const failures: string[] = []
    for (const width of WIDTHS) {
      await setCardWidth(page, width)
      const measured = await measure(page)
      expect(sortedJson(measured.map((m) => m.kind)), `${title}: items drawn at ${width}px`).toEqual(sortedJson([...BOARD_KINDS, commandZone(1, false, 1, 2), commandZone(2, false, 0, 1)]))
      for (const m of measured) {
        const want = predicted(m.kind, opts, width)
        const deviation = Math.abs(m.footprint - want)
        if (deviation > TOLERANCE_PX) {
          failures.push(`${m.label} ${JSON.stringify(m.kind)} at ${width}px: measured ${m.footprint}px, predicted ${want}px`)
        }
      }
    }
    expect(failures, 'items whose width differs from itemModel').toEqual([])
  })
}

test('BRD-28: two commanders in a compact pod: the command zone is 0.88c per commander plus its frame', async ({ page }) => {
  const settings = { gameUi: 'v1', boardLayout: 'arena', boardLayoutManual: true, cardStyle: 'classic', tapStyle: 'upright' }
  await showBoard(page, boardGame(4), settings)
  const failures: string[] = []
  for (const width of WIDTHS) {
    await setCardWidth(page, width)
    const measured = await measure(page)
    if (width === WIDTHS[0]) expect(measured.map((m) => m.kind)).toContainEqual(commandZone(2, true, 0, 1))
    const zones = measured.filter((m) => m.kind.kind === 'commander')
    for (const m of zones) {
      const want = predicted(m.kind, { compact: false, tilted: false }, width)
      const deviation = Math.abs(m.footprint - want)
      if (deviation > TOLERANCE_PX) failures.push(`${m.label} ${JSON.stringify(m.kind)} at ${width}px: measured ${m.footprint}px, predicted ${want}px`)
    }
  }
  expect(failures, 'command zones whose width differs from itemModel').toEqual([])
})
