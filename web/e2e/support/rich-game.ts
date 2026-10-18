import type { Page } from '@playwright/test'

type Rec = Record<string, unknown>

const POOL = { white: 0, blue: 0, black: 0, red: 0, green: 0, colorless: 0 }

function perm(id: string, name: string, types: string[], extra: Rec = {}): Rec {
  return { id, parentId: id, name, displayName: name, cardTypes: types, manaValue: 2, expansionSetCode: '', cardNumber: '0', ...extra }
}

function creature(id: string, name: string, pt: [string, string], extra: Rec = {}): Rec {
  return perm(id, name, ['CREATURE'], { power: pt[0], toughness: pt[1], ...extra })
}

function land(id: string, name: string, extra: Rec = {}): Rec {
  return perm(id, name, ['LAND'], { manaValue: 0, ...extra })
}

function player(id: string, name: string, controlled: boolean, extra: Rec = {}): Rec {
  return {
    playerId: id,
    name,
    life: 40,
    controlled,
    isActive: false,
    hasPriority: false,
    isHuman: true,
    hasLeft: false,
    timerActive: false,
    wins: 0,
    winsNeeded: 1,
    battlefield: {},
    graveyard: {},
    exile: {},
    sideboard: {},
    helperCards: {},
    topCard: null,
    handCount: 5,
    libraryCount: 58,
    counters: [],
    commandList: [],
    attachments: [],
    designationNames: [],
    monarch: false,
    initiative: false,
    manaPool: { ...POOL },
    statesSavedSize: 0,
    priorityTimeSavedTimeMs: 0,
    priorityTimeLeftSecs: 0,
    bufferTimeLeft: 0,
    passedTurn: false,
    passedUntilEndOfTurn: false,
    passedUntilNextMain: false,
    passedUntilStackResolved: false,
    passedAllTurns: false,
    passedUntilEndStepBeforeMyTurn: false,
    ...extra,
  }
}

function byId(items: Rec[]): Record<string, Rec> {
  return Object.fromEntries(items.map((c) => [String(c.id), c]))
}

export interface StackSpec {
  id: string
  name: string
  controllerId: string
  ability?: boolean
  targets?: string[]
  rules?: string[]
}

export interface RichGameOptions {
  step?: string
  stack?: StackSpec[]
}

export function richCommanderGame(opts: RichGameOptions = {}): Rec {
  const me = player('p-adam', 'Adam', true, {
    isActive: true,
    hasPriority: true,
    handCount: 4,
    life: 40,
    commandList: [
      { id: 'cmd-adam', name: 'Korvold, Fae-Cursed King', mageObjectType: 'COMMANDER', cardTypes: ['CREATURE'], manaValue: 5, rules: ['<b>Commander</b>', '<b>Commander</b> did 7 combat damage to player Tobias.'] },
      { id: 'ring-adam', name: 'The Ring', mageObjectType: 'EMBLEM', cardTypes: ['EMBLEM'], manaValue: 0, rules: ['Your Ring-bearer is legendary.', 'Whenever your Ring-bearer attacks, draw then discard.', 'Blocked: sacrifice the blocker.'] },
    ],
    battlefield: byId([
      creature('adam-korvold', 'Korvold, Fae-Cursed King', ['7', '7'], { manaValue: 5 }),
      creature('adam-dockside', 'Dockside Extortionist', ['1', '2']),
      creature('adam-fanatic', 'Mogg Fanatic', ['1', '1']),
      perm('adam-solring', 'Sol Ring', ['ARTIFACT'], { tapped: true }),
      perm('adam-pact', 'Grave Pact', ['ENCHANTMENT']),
      land('adam-l1', 'Swamp'),
      land('adam-l2', 'Mountain'),
      land('adam-l3', 'Forest'),
    ]),
  })
  const mira = player('p-mira', 'Mira', false, {
    handCount: 5,
    life: 31,
    designationNames: [],
    commandList: [
      { id: 'cmd-mira', name: 'Yuriko, the Tiger’s Shadow', mageObjectType: 'COMMANDER', cardTypes: ['CREATURE'], manaValue: 2, rules: ['<b>Commander</b>', '<b>Commander</b> did 9 combat damage to player Adam.'] },
      { id: 'dun-mira', name: 'Lost Mine of Phandelver', mageObjectType: 'DUNGEON', cardTypes: ['DUNGEON'], manaValue: 0 },
    ],
    battlefield: byId([
      creature('mira-yuriko', 'Yuriko, the Tiger’s Shadow', ['1', '3']),
      creature('mira-ninja', 'Ninja of the Deep Hours', ['2', '2']),
      perm('mira-rhystic', 'Rhystic Study', ['ENCHANTMENT']),
      land('mira-l1', 'Island'),
      land('mira-l2', 'Swamp'),
    ]),
  })
  const tobias = player('p-tobias', 'Tobias', false, {
    handCount: 3,
    life: 27,
    monarch: true,
    commandList: [{ id: 'cmd-tobias', name: 'Edgar Markov', mageObjectType: 'COMMANDER', cardTypes: ['CREATURE'], manaValue: 6, rules: ['<b>Commander</b>', '<b>Commander</b> did 16 combat damage to player Adam.', '<b>Commander</b> did 6 combat damage to player Mira.'] }],
    battlefield: byId([
      creature('tobias-edgar', 'Edgar Markov', ['4', '4']),
      creature('tobias-cathar', 'Cathar Commando', ['3', '1']),
      perm('tobias-bond', 'Sanguine Bond', ['ENCHANTMENT']),
      land('tobias-l1', 'Plains'),
      land('tobias-l2', 'Mountain'),
    ]),
  })
  const ilse = player('p-ilse', 'Ilse', false, {
    handCount: 6,
    life: 40,
    initiative: true,
    designationNames: ["City's Blessing"],
    commandList: [{ id: 'cmd-ilse', name: 'Muldrotha, the Gravetide', mageObjectType: 'COMMANDER', cardTypes: ['CREATURE'], manaValue: 6, rules: ['<b>Commander</b>', '<b>Commander</b> did 21 combat damage to player Mira.'] }],
    battlefield: byId([
      creature('ilse-muldrotha', 'Muldrotha, the Gravetide', ['6', '6']),
      creature('ilse-witness', 'Eternal Witness', ['2', '1']),
      land('ilse-l1', 'Forest'),
      land('ilse-l2', 'Island'),
    ]),
  })
  const stack = (opts.stack ?? []).map((s) =>
    s.ability
      ? { id: s.id, name: s.name, displayName: s.name, cardTypes: [], mageObjectType: 'ABILITY', abilityType: 'Triggered', controllerId: s.controllerId, targets: s.targets ?? [], rules: s.rules ?? [], manaValue: 0 }
      : { id: s.id, name: s.name, displayName: s.name, cardTypes: ['INSTANT'], controllerId: s.controllerId, targets: s.targets ?? [], rules: s.rules ?? [], manaValue: 1, expansionSetCode: '', cardNumber: '0' },
  )
  return {
    players: [me, mira, tobias, ilse],
    myPlayerId: 'p-adam',
    myHand: byId([
      { id: 'h-bolt', name: 'Lightning Bolt', parentId: 'h-bolt', cardTypes: ['INSTANT'], manaValue: 1, manaCostLeftStr: ['{R}'], rules: ['Lightning Bolt deals 3 damage to any target.'], expansionSetCode: '', cardNumber: '0' },
      { id: 'h-pact', name: 'Pact of Negation', parentId: 'h-pact', cardTypes: ['INSTANT'], manaValue: 0, rules: ['Counter target spell.'], expansionSetCode: '', cardNumber: '0' },
      { id: 'h-birds', name: 'Birds of Paradise', parentId: 'h-birds', cardTypes: ['CREATURE'], power: '0', toughness: '1', manaValue: 1, manaCostLeftStr: ['{G}'], rules: ['Flying', '{T}: Add one mana of any color.'], expansionSetCode: '', cardNumber: '0' },
      { id: 'h-mountain', name: 'Mountain', parentId: 'h-mountain', cardTypes: ['LAND'], manaValue: 0, expansionSetCode: '', cardNumber: '0' },
    ]),
    myHelperEmblems: {},
    canPlayObjects: {},
    opponentHands: {},
    watchedHands: {},
    stack: byId(stack),
    exiles: [],
    revealed: [],
    lookedAt: [],
    companion: [],
    combat: [],
    turn: 7,
    phase: opts.step ?? 'PRECOMBAT_MAIN',
    step: opts.step ?? 'PRECOMBAT_MAIN',
    activePlayerId: 'p-adam',
    activePlayerName: 'Adam',
    priorityPlayerName: 'Adam',
    special: false,
    rollbackTurnsAllowed: false,
    totalErrorsCount: 0,
    totalEffectsCount: 0,
    gameCycle: 1,
    priorityTime: 0,
    bufferTime: 0,
  }
}

export async function showGame(page: Page, game: Rec, settings: Rec = {}, log: string[] = []): Promise<void> {
  await page.evaluate(
    ({ gameView, patch, lines }) => {
      const store = (globalThis as unknown as { __mageStore?: { getState: () => Record<string, any>; setState: (s: unknown) => void } }).__mageStore
      const st = store?.getState() as { settings: Record<string, unknown> }
      const entries = lines.map((text, i) => ({ id: i + 1, time: Date.now() + i, text, channel: 'game' }))
      store?.setState({ phase: 'game', gameId: 'g-v2', settings: { ...st.settings, ...patch }, game: gameView, log: entries })
    },
    { gameView: game, patch: settings, lines: log },
  )
}
