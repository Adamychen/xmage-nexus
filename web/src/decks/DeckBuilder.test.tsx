import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import DeckBuilder from './DeckBuilder'
import type { CardStripMeta } from './ArenaCardStrip'
import type { DeckStackPiles } from './stackPiles'
import type { DeckCard } from '../lobby/decks'
import { setSetting } from '../state/actions'
import { getState } from '../state/store'
import { setCardLanguage, t } from '../i18n'
import { resetCardLocalizationCacheForTest, setCachedCardName } from '../cards/cardLocalization'

const fallbackMocks = vi.hoisted(() => ({
  available: [] as unknown[],
  missing: [] as string[],
  deck: null as Record<string, unknown> | null,
}))

const metaState = vi.hoisted(() => ({ map: new Map<string, CardStripMeta>() }))

const mocks = vi.hoisted(() => {
  const deck = {
    id: 'd1',
    name: 'Mazo Original',
    format: 'Freeform' as const,
    cards: [] as unknown[],
    sideboard: [] as unknown[],
    coverCard: null,
    commanderCard: null,
    partnerCard: null,
    updatedAt: 0,
  }
  return { deck, put: vi.fn(async (_d: unknown) => {}) }
})

vi.mock('./storage', () => ({
  getDeckStorage: () => ({
    get: async (id: string) => (fallbackMocks.missing.includes(id) ? null : { ...(fallbackMocks.deck ?? mocks.deck) }),
    put: mocks.put,
    list: async () => fallbackMocks.available,
  }),
}))

vi.mock('../lobby/decks', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../lobby/decks')>()
  return { ...mod, getAllAvailableDecks: () => fallbackMocks.available }
})

vi.mock('./useDeckMetadata', () => ({
  useDeckMetadata: () => ({
    metaMap: metaState.map,
    setMetaMap: vi.fn(),
    updateMetaForDeck: vi.fn(),
    cmcNumberMap: new Map<string, number>(),
  }),
}))

interface Saved {
  cards: DeckCard[]
  sideboard: DeckCard[]
  stackPiles?: DeckStackPiles
}

const bolt: DeckCard = { cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 3 }
const bears: DeckCard = { cardName: 'Grizzly Bears', setCode: 'M10', cardNumber: '200', amount: 1 }
const shock: DeckCard = { cardName: 'Shock', setCode: 'M10', cardNumber: '180', amount: 16 }

const boltMeta: CardStripMeta = {
  typeLine: 'Instant', cmc: 1, manaCost: '{R}', colors: ['R'], rarity: 'common', imageUrl: 'https://img.test/bolt.jpg',
}
const bearsMeta: CardStripMeta = {
  typeLine: 'Creature — Bear', cmc: 2, manaCost: '{1}{G}', colors: ['G'], rarity: 'common', imageUrl: 'https://img.test/bears.jpg',
}
const shockMeta: CardStripMeta = {
  typeLine: 'Instant', cmc: 1, manaCost: '{R}', colors: ['R'], rarity: 'common', imageUrl: 'https://img.test/shock.jpg',
}

function loadMeta(entries: Array<[string, CardStripMeta]>) {
  metaState.map = new Map(entries.flatMap(([key, meta]) => [[`M10/${key}`, meta]] as Array<[string, CardStripMeta]>))
}

function setDeck(over: Record<string, unknown> = {}) {
  fallbackMocks.deck = { id: 'd1', name: 'Mazo Piles', format: 'Freeform', cards: [bolt, bears], sideboard: [shock], coverCard: null, commanderCard: null, partnerCard: null, updatedAt: 0, ...over }
}

function resetSettings() {
  act(() => {
    setSetting('deckEditorView', 'piles')
    setSetting('deckStacksGroup', 'type')
    setSetting('deckStacksSort', 'cmc')
    setSetting('deckStacksCopies', 'separate')
    setSetting('deckStacksScale', 100)
    setSetting('deckEditorDrawer', true)
    setSetting('deckStacksSeparateCreatures', false)
  })
}

function cardEl(key: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-card-key="${key}"][data-front="true"]`)
  if (!el) throw new Error(`no card ${key}`)
  return el
}

async function savedDeck(predicate: (d: Saved) => boolean): Promise<Saved> {
  let found: Saved | undefined
  await waitFor(() => {
    found = mocks.put.mock.calls.map((call) => call[0] as Saved).reverse().find(predicate)
    expect(found).toBeDefined()
  }, { timeout: 3000 })
  return found as Saved
}

describe('DeckBuilder · saving on close (UX audit)', () => {
  afterEach(() => {
    cleanup()
    mocks.put.mockClear()
  })

  it('saves the pending edit when Done is pressed (the debounce used to drop it)', async () => {
    const onClose = vi.fn()
    render(<DeckBuilder deckId="d1" onClose={onClose} />)
    const input = await screen.findByDisplayValue('Mazo Original')

    fireEvent.change(input, { target: { value: 'Mazo Renombrado' } })
    fireEvent.click(document.querySelector('[data-testid="builder-done"]')!)

    await waitFor(() => expect(mocks.put).toHaveBeenCalledOnce())
    expect(mocks.put.mock.calls[0][0]).toMatchObject({ id: 'd1', name: 'Mazo Renombrado' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('also saves when going back with ← My decks', async () => {
    const onClose = vi.fn()
    render(<DeckBuilder deckId="d1" onClose={onClose} />)
    const input = await screen.findByDisplayValue('Mazo Original')

    fireEvent.change(input, { target: { value: 'Otro Nombre' } })
    fireEvent.click(document.querySelector('.builder-back')!)

    await waitFor(() => expect(mocks.put).toHaveBeenCalledOnce())
    expect(mocks.put.mock.calls[0][0]).toMatchObject({ name: 'Otro Nombre' })
    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('DeckBuilder · resolving decks the storage does not hold', () => {
  afterEach(() => {
    cleanup()
    fallbackMocks.available = []
    fallbackMocks.missing = []
  })

  const builder = (deckId: string) => render(<DeckBuilder deckId={deckId} onClose={vi.fn()} />)

  it('loads a saved deck without an id when given its name', async () => {
    fallbackMocks.available = [{ id: undefined, name: 'Mazo Inicial', format: 'Modern', cards: [], sideboard: [] }]
    fallbackMocks.missing = ['Mazo Inicial']
    builder('Mazo Inicial')
    await waitFor(() => expect(screen.queryByText(/no se encontr|not found/i)).toBeNull())
    await screen.findByDisplayValue('Mazo Inicial')
  })

  it('loads a catalogue deck by its ref', async () => {
    fallbackMocks.available = [{ id: 'precon:Mage Web bolt', name: 'Mage Web bolt', format: 'Modern', cards: [], sideboard: [] }]
    fallbackMocks.missing = ['precon:Mage Web bolt']
    builder('precon:Mage Web bolt')
    await waitFor(() => expect(screen.queryByText(/no se encontr|not found/i)).toBeNull())
    await screen.findByDisplayValue('Mage Web bolt')
  })
})

describe('DeckBuilder · the editor with piles', () => {
  beforeEach(() => {
    setDeck()
    loadMeta([['146', boltMeta], ['200', bearsMeta], ['180', shockMeta]])
  })

  afterEach(() => {
    cleanup()
    mocks.put.mockClear()
    fallbackMocks.deck = null
    metaState.map = new Map()
    resetSettings()
  })

  it('DCK-5: Piles is the default view, and List view shows the strips instead', async () => {
    const { container } = render(<DeckBuilder deckId="d1" onClose={vi.fn()} />)
    await screen.findByTestId('deck-editor-piles')
    expect(container.querySelector('.arena-deck-list-container')).toBeNull()

    act(() => setSetting('deckEditorView', 'list'))
    expect(screen.queryByTestId('deck-editor-piles')).toBeNull()
    expect(container.querySelector('.arena-deck-list-container')).not.toBeNull()
    expect(container.querySelector('.deck-numbers-panel')).not.toBeNull()
  })

  it('DCK-6: Group changes the columns of the main piles', async () => {
    render(<DeckBuilder deckId="d1" onClose={vi.fn()} />)
    await screen.findByTestId('deck-editor-piles')
    expect(document.querySelector('[data-column="creatures"]')).not.toBeNull()
    expect(document.querySelector('[data-column="cmc-1"]')).toBeNull()

    fireEvent.click(document.querySelector('[data-control="group"] [data-value="cmc"]')!)
    await waitFor(() => expect(document.querySelector('[data-column="cmc-1"]')).not.toBeNull())
    expect(document.querySelector('[data-column="cmc-2"]')).not.toBeNull()
    expect(document.querySelector('[data-column="creatures"]')).toBeNull()
  })

  it('DCK-7: Free seeds its piles from the type grouping once every card has its data', async () => {
    render(<DeckBuilder deckId="d1" onClose={vi.fn()} />)
    await screen.findByTestId('deck-editor-piles')
    act(() => setSetting('deckStacksGroup', 'free'))

    const saved = await savedDeck((d) => (d.stackPiles?.piles.length ?? 0) > 0)
    expect(saved.stackPiles?.piles).toHaveLength(2)
    expect(Object.values(saved.stackPiles?.assign ?? {})).toHaveLength(2)
  })

  it('DCK-7: dropping a deck card on the new-pile column creates a pile and saves it', async () => {
    setDeck({
      stackPiles: { piles: [{ id: 'p1', label: 'Spells' }], assign: { 'M10:146:Lightning Bolt': { p1: 3 } } },
    })
    render(<DeckBuilder deckId="d1" onClose={vi.fn()} />)
    await screen.findByTestId('deck-editor-piles')
    act(() => setSetting('deckStacksGroup', 'free'))

    const target = await waitFor(() => {
      const column = document.querySelector<HTMLElement>('[data-column="__new__"]')
      expect(column).not.toBeNull()
      return column!
    })
    fireEvent.drop(target, {
      dataTransfer: { getData: () => JSON.stringify({ source: 'main', key: 'M10:200:Grizzly Bears' }) },
    })

    const saved = await savedDeck((d) => (d.stackPiles?.piles.length ?? 0) === 2)
    const created = saved.stackPiles!.piles[1]
    expect(saved.stackPiles!.assign['M10:200:Grizzly Bears']).toEqual({ [created.id]: 1 })
    expect(saved.stackPiles!.assign['M10:146:Lightning Bolt']).toEqual({ p1: 3 })
  })

  it('DCK-7: dragging one copy of a card to another pile moves that copy only and saves 2 and 1', async () => {
    setDeck({
      stackPiles: {
        piles: [{ id: 'p1', label: 'Burn' }, { id: 'p2', label: 'Finish' }],
        assign: { 'M10:146:Lightning Bolt': { p1: 3 } },
      },
    })
    render(<DeckBuilder deckId="d1" onClose={vi.fn()} />)
    await screen.findByTestId('deck-editor-piles')
    act(() => setSetting('deckStacksGroup', 'free'))

    const setData = vi.fn()
    fireEvent.dragStart(cardEl('M10:146:Lightning Bolt'), { dataTransfer: { setData, effectAllowed: 'move' } })
    const payload = setData.mock.calls[0][1] as string
    const target = await waitFor(() => {
      const column = document.querySelector<HTMLElement>('[data-column="p2"]')
      expect(column).not.toBeNull()
      return column!
    })
    fireEvent.drop(target, { dataTransfer: { getData: () => payload } })

    const saved = await savedDeck((d) => d.stackPiles?.assign['M10:146:Lightning Bolt']?.p2 === 1)
    expect(saved.stackPiles!.assign['M10:146:Lightning Bolt']).toEqual({ p1: 2, p2: 1 })
    expect(saved.cards.find((c) => c.cardName === 'Lightning Bolt')?.amount).toBe(3)
    expect(document.querySelector('[data-column="p1"] [data-card-key="M10:146:Lightning Bolt"][data-front="true"] .arena-stack-qty')?.textContent).toBe('×2')
  })

  it('DCK-7: a deck saved with one pile per card opens with every copy in that pile', async () => {
    setDeck({
      stackPiles: { piles: [{ id: 'p1', label: 'Spells' }], assign: { 'M10:146:Lightning Bolt': 'p1' } },
    })
    render(<DeckBuilder deckId="d1" onClose={vi.fn()} />)
    await screen.findByTestId('deck-editor-piles')
    act(() => setSetting('deckStacksGroup', 'free'))

    const pile = document.querySelector('[data-column="p1"]')!
    expect(pile.querySelector('[data-card-key="M10:146:Lightning Bolt"][data-front="true"] .arena-stack-qty')?.textContent).toBe('×3')
    expect(document.querySelectorAll('[data-card-key="M10:146:Lightning Bolt"]')).toHaveLength(3)
  })

  it('DCK-8: Copies draws every copy of a card on its own, or one tile for all of them', async () => {
    render(<DeckBuilder deckId="d1" onClose={vi.fn()} />)
    await screen.findByTestId('deck-editor-piles')
    expect(document.querySelectorAll('[data-card-key="M10:146:Lightning Bolt"]')).toHaveLength(3)

    act(() => setSetting('deckStacksCopies', 'together'))
    await waitFor(() => expect(document.querySelectorAll('[data-card-key="M10:146:Lightning Bolt"]')).toHaveLength(1))
  })

  it('DCK-9: clicking a card selects it, and the panel removes one copy from the main deck', async () => {
    render(<DeckBuilder deckId="d1" onClose={vi.fn()} />)
    await screen.findByTestId('deck-editor-piles')

    fireEvent.click(cardEl('M10:146:Lightning Bolt'))
    expect(document.querySelector('.card-focus-name')?.textContent).toBe('Lightning Bolt')
    fireEvent.click(document.querySelector('.card-focus-dec')!)

    const saved = await savedDeck((d) => d.cards.some((c) => c.cardName === 'Lightning Bolt' && c.amount === 2))
    expect(saved.sideboard.find((c) => c.cardName === 'Shock')?.amount).toBe(16)
  })

  it('DCK-9: To sideboard moves one copy of a main card, and To main moves a sideboard card back', async () => {
    render(<DeckBuilder deckId="d1" onClose={vi.fn()} />)
    await screen.findByTestId('deck-editor-piles')

    fireEvent.click(cardEl('M10:200:Grizzly Bears'))
    fireEvent.click(document.querySelector('.card-focus-swap')!)
    const moved = await savedDeck((d) => d.sideboard.some((c) => c.cardName === 'Grizzly Bears'))
    expect(moved.cards.some((c) => c.cardName === 'Grizzly Bears')).toBe(false)

    fireEvent.click(cardEl('sb:M10:180:Shock'))
    expect(document.querySelector('.card-focus-name')?.textContent).toBe('Shock')
    fireEvent.click(document.querySelector('.card-focus-swap')!)
    const back = await savedDeck((d) => d.cards.some((c) => c.cardName === 'Shock'))
    expect(back.cards.find((c) => c.cardName === 'Shock')?.amount).toBe(1)
    expect(back.sideboard.find((c) => c.cardName === 'Shock')?.amount).toBe(15)
  })

  it('DCK-10: the panel shows the hovered deck card, and the numbers stay under it', async () => {
    const { container } = render(<DeckBuilder deckId="d1" onClose={vi.fn()} />)
    await screen.findByTestId('deck-editor-piles')
    expect(container.querySelector('.card-focus-panel')).toBeNull()
    expect(container.querySelector('.deck-numbers-panel')).not.toBeNull()

    fireEvent.mouseEnter(cardEl('M10:200:Grizzly Bears'))
    expect(document.querySelector('.card-focus-name')?.textContent).toBe('Grizzly Bears')
    expect(document.querySelector('.deck-numbers-panel')).not.toBeNull()
  })

  it('DCK-10: List view shows only the numbers, without the card panel', async () => {
    const { container } = render(<DeckBuilder deckId="d1" onClose={vi.fn()} />)
    await screen.findByTestId('deck-editor-piles')
    act(() => setSetting('deckEditorView', 'list'))
    expect(container.querySelector('.card-focus-panel')).toBeNull()
    expect(container.querySelector('.deck-numbers-panel')).not.toBeNull()
  })

  it('DCK-10: after a copy is dropped in Free, the next hovered card shows its own name, picture and type line', async () => {
    const foundry: DeckCard = { cardName: 'Sacred Foundry', setCode: 'ZNR', cardNumber: '254', amount: 4 }
    const foundryMeta: CardStripMeta = {
      typeLine: 'Land — Mountain Plains', cmc: 0, manaCost: '', colors: [], rarity: 'rare', imageUrl: 'https://img.test/foundry.jpg',
    }
    setDeck({
      cards: [bolt, bears, foundry],
      stackPiles: {
        piles: [{ id: 'p1', label: 'Burn' }, { id: 'p2', label: 'Lands' }],
        assign: { 'M10:146:Lightning Bolt': { p1: 3 }, 'ZNR:254:Sacred Foundry': { p2: 4 } },
      },
    })
    metaState.map.set('ZNR/254', foundryMeta)
    setCardLanguage('es')
    setCachedCardName('Lightning Bolt', 'Relámpago', 'es')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 404, json: async () => ({}) } as Response)
    try {
      render(<DeckBuilder deckId="d1" onClose={vi.fn()} />)
      await screen.findByTestId('deck-editor-piles')
      act(() => setSetting('deckStacksGroup', 'free'))

      const setData = vi.fn()
      fireEvent.dragStart(cardEl('M10:146:Lightning Bolt'), { dataTransfer: { setData, effectAllowed: 'move' } })
      const payload = setData.mock.calls[0][1] as string
      const lands = await waitFor(() => {
        const column = document.querySelector<HTMLElement>('[data-column="p2"]')
        expect(column).not.toBeNull()
        return column!
      })
      fireEvent.drop(lands, { dataTransfer: { getData: () => payload } })
      await savedDeck((d) => d.stackPiles?.assign['M10:146:Lightning Bolt']?.p2 === 1)

      fireEvent.mouseEnter(document.querySelector('[data-column="p2"] [data-card-key="M10:146:Lightning Bolt"][data-front="true"]')!)
      expect(document.querySelector('.card-focus-name')?.textContent).toBe('Relámpago')

      fireEvent.mouseEnter(cardEl('ZNR:254:Sacred Foundry'))
      await waitFor(() => expect(document.querySelector('.card-focus-name')?.textContent).toBe('Sacred Foundry'))
      expect(document.querySelector('.card-focus-image')?.getAttribute('alt')).toBe('Sacred Foundry')
      expect(document.querySelector('.card-focus-image')?.getAttribute('src')).toBe('https://img.test/foundry.jpg')
      expect(document.querySelector('.card-focus-type')?.textContent).toBe('Land — Mountain Plains')
    } finally {
      fetchSpy.mockRestore()
      setCardLanguage('en')
      resetCardLocalizationCacheForTest()
    }
  })

  it('DCK-11: a card whose data is still loading waits in the Loading pile', async () => {
    loadMeta([['146', boltMeta]])
    render(<DeckBuilder deckId="d1" onClose={vi.fn()} />)
    await screen.findByTestId('deck-editor-piles')

    const loading = document.querySelector('[data-column="loading"]')
    expect(loading?.querySelector('[data-card-key="M10:200:Grizzly Bears"]')).not.toBeNull()
    expect(document.querySelector('[data-column="creatures"]')).toBeNull()
  })

  it('DCK-11: Free does not seed piles while a card is still loading', async () => {
    loadMeta([['146', boltMeta]])
    render(<DeckBuilder deckId="d1" onClose={vi.fn()} />)
    await screen.findByTestId('deck-editor-piles')
    act(() => setSetting('deckStacksGroup', 'free'))

    expect(document.querySelector('[data-column="unsorted"]')).not.toBeNull()
    expect(document.querySelector('[data-column="p1"]')).toBeNull()
  })

  it('DCK-12: the Add cards toggle hides the catalogue drawer and gives the deck its width', async () => {
    const { container } = render(<DeckBuilder deckId="d1" onClose={vi.fn()} />)
    await screen.findByTestId('deck-editor-piles')
    expect(container.querySelector('.builder-left')).not.toBeNull()

    fireEvent.click(container.querySelector('.deck-editor-drawer-toggle')!)
    expect(container.querySelector('.builder-left')).toBeNull()
    expect(container.querySelector('.deck-builder-body.has-drawer')).toBeNull()

    fireEvent.click(container.querySelector('.deck-editor-drawer-toggle')!)
    expect(container.querySelector('.builder-left')).not.toBeNull()
  })

  it('DCK-13: the sideboard band counts its cards against the limit and folds', async () => {
    setDeck({ format: 'Modern', sideboard: [{ ...shock, amount: 16 }] })
    const { container } = render(<DeckBuilder deckId="d1" onClose={vi.fn()} />)
    await screen.findByTestId('deck-editor-side-band')

    const count = container.querySelector('.deck-editor-side-count')
    expect(count?.textContent).toBe('16/15')
    expect(count?.classList.contains('is-over')).toBe(true)

    const fold = container.querySelector<HTMLButtonElement>('.deck-editor-side-head button')!
    expect(fold.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(fold)
    expect(fold.getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelector('.deck-editor-side-body')).toBeNull()
    fireEvent.click(fold)
    expect(container.querySelector('.deck-editor-side-body')).not.toBeNull()
  })

  it('DCK-13: a folded band takes a main-deck card dropped on its header, moving one copy and updating the count', async () => {
    const { container } = render(<DeckBuilder deckId="d1" onClose={vi.fn()} />)
    await screen.findByTestId('deck-editor-side-band')
    fireEvent.click(container.querySelector<HTMLButtonElement>('.deck-editor-side-head button')!)
    expect(container.querySelector('.deck-editor-side-body')).toBeNull()

    const head = container.querySelector<HTMLElement>('.deck-editor-side-head')!
    const dataTransfer = {
      types: ['application/json'],
      getData: () => JSON.stringify({ source: 'main', key: 'M10:146:Lightning Bolt' }),
    }
    fireEvent.dragOver(head, { dataTransfer })
    expect(head.classList.contains('is-drop-target')).toBe(true)
    fireEvent.drop(head, { dataTransfer })
    expect(head.classList.contains('is-drop-target')).toBe(false)

    const saved = await savedDeck((d) => d.sideboard.some((c) => c.cardName === 'Lightning Bolt'))
    expect(saved.cards.find((c) => c.cardName === 'Lightning Bolt')?.amount).toBe(2)
    expect(saved.sideboard.find((c) => c.cardName === 'Lightning Bolt')?.amount).toBe(1)
    expect(saved.sideboard.find((c) => c.cardName === 'Shock')?.amount).toBe(16)
    expect(container.querySelector('.deck-editor-side-count')?.textContent).toBe('17/99')
  })

  it('DCK-13: a folded band takes a catalogue card dropped on its header, adding one copy and updating the count', async () => {
    const { container } = render(<DeckBuilder deckId="d1" onClose={vi.fn()} />)
    await screen.findByTestId('deck-editor-side-band')
    fireEvent.click(container.querySelector<HTMLButtonElement>('.deck-editor-side-head button')!)

    const head = container.querySelector<HTMLElement>('.deck-editor-side-head')!
    const dataTransfer = {
      types: ['application/json'],
      getData: () => JSON.stringify({ source: 'search', cardName: 'Giant Growth', setCode: 'LEA', cardNumber: '161' }),
    }
    fireEvent.dragOver(head, { dataTransfer })
    fireEvent.drop(head, { dataTransfer })

    const saved = await savedDeck((d) => d.sideboard.some((c) => c.cardName === 'Giant Growth'))
    expect(saved.sideboard.find((c) => c.cardName === 'Giant Growth')?.amount).toBe(1)
    expect(saved.cards.find((c) => c.cardName === 'Lightning Bolt')?.amount).toBe(3)
    expect(saved.cards.find((c) => c.cardName === 'Grizzly Bears')?.amount).toBe(1)
    expect(container.querySelector('.deck-editor-side-count')?.textContent).toBe('17/99')
  })

  it('DCK-1: the size slider scales the main piles and leaves the sideboard band at its size', async () => {
    const { container } = render(<DeckBuilder deckId="d1" onClose={vi.fn()} />)
    await screen.findByTestId('deck-editor-piles')

    const slider = container.querySelector<HTMLInputElement>('.deck-editor-scale input[type="range"]')!
    fireEvent.change(slider, { target: { value: '200' } })

    expect(screen.getByTestId('deck-editor-piles').style.getPropertyValue('--stack-scale')).toBe('2')
    expect(screen.getByTestId('deck-editor-side-band').style.getPropertyValue('--stack-scale')).toBe('')
  })

  it('DCK-3: hovering a deck card in Piles view does not open the floating preview', async () => {
    render(<DeckBuilder deckId="d1" onClose={vi.fn()} />)
    await screen.findByTestId('deck-editor-piles')

    fireEvent.mouseEnter(cardEl('M10:200:Grizzly Bears'))
    expect(document.querySelector('.arena-floating-preview')).toBeNull()
  })

  it('DCK-16: the separate creatures toggle draws the creatures in a first row and the other cards in a second, both grouped by mana value', async () => {
    render(<DeckBuilder deckId="d1" onClose={vi.fn()} />)
    await screen.findByTestId('deck-editor-piles')
    act(() => setSetting('deckStacksGroup', 'cmc'))
    expect(document.querySelector('.deck-editor-pile-row')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: t('decks', 'toggle_separate_creatures') }))

    const creatures = document.querySelector<HTMLElement>('.deck-editor-piles [data-row="creatures"]')!
    const others = document.querySelector<HTMLElement>('.deck-editor-piles [data-row="others"]')!
    expect(document.querySelectorAll('.deck-editor-piles > .deck-editor-pile-row')).toHaveLength(2)
    expect(creatures.querySelector('[data-column="cmc-2"]')).not.toBeNull()
    expect(creatures.querySelector('[data-column="cmc-1"]')).toBeNull()
    expect(others.querySelector('[data-column="cmc-1"]')).not.toBeNull()
    expect(others.querySelector('[data-column="cmc-2"]')).toBeNull()
    expect(creatures.querySelector('[data-card-key="M10:200:Grizzly Bears"]')).not.toBeNull()
    expect(others.querySelector('[data-card-key="M10:146:Lightning Bolt"]')).not.toBeNull()
  })

  it('DCK-16: the sideboard band stays one row while the main deck has two', async () => {
    render(<DeckBuilder deckId="d1" onClose={vi.fn()} />)
    await screen.findByTestId('deck-editor-piles')
    act(() => {
      setSetting('deckStacksGroup', 'cmc')
      setSetting('deckStacksSeparateCreatures', true)
    })

    expect(document.querySelectorAll('.deck-editor-piles > .deck-editor-pile-row')).toHaveLength(2)
    const band = screen.getByTestId('deck-editor-side-band')
    expect(band.querySelector('.deck-editor-pile-row')).toBeNull()
    expect(band.querySelectorAll('.arena-stack-board')).toHaveLength(1)
  })

  it.each(['type', 'free'] as const)('DCK-16: %s draws one row even while separate creatures is on', async (group) => {
    render(<DeckBuilder deckId="d1" onClose={vi.fn()} />)
    await screen.findByTestId('deck-editor-piles')
    act(() => {
      setSetting('deckStacksSeparateCreatures', true)
      setSetting('deckStacksGroup', group)
    })

    expect(document.querySelector('.deck-editor-pile-row')).toBeNull()
    expect(screen.getByTestId('deck-editor-piles').querySelectorAll('.arena-stack-board')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: t('decks', 'toggle_separate_creatures') })).toBeNull()
  })

  it('DCK-16: the toggle saves the choice, and turning it off returns to one row', async () => {
    render(<DeckBuilder deckId="d1" onClose={vi.fn()} />)
    await screen.findByTestId('deck-editor-piles')
    act(() => setSetting('deckStacksGroup', 'cmc'))
    const toggle = screen.getByRole('button', { name: t('decks', 'toggle_separate_creatures') })

    fireEvent.click(toggle)
    expect(getState().settings.deckStacksSeparateCreatures).toBe(true)
    expect(screen.getByRole('button', { name: t('decks', 'toggle_separate_creatures') }).getAttribute('aria-pressed')).toBe('true')
    expect(document.querySelectorAll('.deck-editor-piles > .deck-editor-pile-row')).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: t('decks', 'toggle_separate_creatures') }))
    expect(getState().settings.deckStacksSeparateCreatures).toBe(false)
    expect(document.querySelector('.deck-editor-pile-row')).toBeNull()
  })

  it('DCK-3: in List view hovering a deck card still opens the floating preview', async () => {
    const { container } = render(<DeckBuilder deckId="d1" onClose={vi.fn()} />)
    await screen.findByTestId('deck-editor-piles')
    act(() => setSetting('deckEditorView', 'list'))

    fireEvent.mouseEnter(container.querySelector('.arena-card-strip[data-card-key="M10:200:Grizzly Bears"]')!)
    await waitFor(() => expect(document.querySelector('.arena-floating-preview')).not.toBeNull())
  })
})

function mockPhoneWidth(phone: boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: phone && query === '(max-width: 699px)',
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

describe('DeckBuilder · the editor on a phone', () => {
  beforeEach(() => {
    mockPhoneWidth(true)
    setDeck()
    loadMeta([['146', boltMeta], ['200', bearsMeta], ['180', shockMeta]])
  })

  afterEach(() => {
    cleanup()
    mocks.put.mockClear()
    fallbackMocks.deck = null
    metaState.map = new Map()
    resetSettings()
    delete (window as { matchMedia?: unknown }).matchMedia
  })

  it('DCK-14: below 700 px the zone switch shows the sideboard piles, and the band is not shown apart', async () => {
    const { container } = render(<DeckBuilder deckId="d1" onClose={vi.fn()} />)
    await screen.findByTestId('deck-editor-piles')
    expect(document.querySelector('[data-card-key="M10:146:Lightning Bolt"]')).not.toBeNull()
    expect(screen.queryByTestId('deck-editor-side-band')).toBeNull()
    expect(container.querySelector('.deck-builder-body')).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: t('decks', 'sideboard') }))
    expect(document.querySelector('[data-card-key="sb:M10:180:Shock"]')).not.toBeNull()
    expect(document.querySelector('[data-card-key="M10:146:Lightning Bolt"]')).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: t('decks', 'zone_main') }))
    expect(document.querySelector('[data-card-key="M10:146:Lightning Bolt"]')).not.toBeNull()
  })

  it('DCK-14: tapping a card opens the action sheet, and its minus button removes one copy', async () => {
    render(<DeckBuilder deckId="d1" onClose={vi.fn()} />)
    await screen.findByTestId('deck-editor-piles')
    expect(screen.queryByTestId('deck-phone-card')).toBeNull()

    fireEvent.click(cardEl('M10:146:Lightning Bolt'))
    const sheet = await screen.findByTestId('deck-phone-card')
    expect(sheet.querySelector('.card-focus-name')?.textContent).toBe('Lightning Bolt')
    expect(sheet.querySelector('.card-focus-swap')).not.toBeNull()

    fireEvent.click(sheet.querySelector('.card-focus-dec')!)
    const saved = await savedDeck((d) => d.cards.some((c) => c.cardName === 'Lightning Bolt' && c.amount === 2))
    expect(saved.sideboard.find((c) => c.cardName === 'Shock')?.amount).toBe(16)

    fireEvent.click(within(sheet).getByRole('button', { name: t('common', 'close') }))
    expect(screen.queryByTestId('deck-phone-card')).toBeNull()
  })

  it('DCK-14: Add cards opens the catalogue as a full-screen sheet with a close button', async () => {
    render(<DeckBuilder deckId="d1" onClose={vi.fn()} />)
    await screen.findByTestId('deck-editor-piles')
    expect(screen.queryByTestId('deck-phone-catalogue')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: t('decks', 'editor_add_cards') }))
    const sheet = await screen.findByTestId('deck-phone-catalogue')
    expect(sheet.classList.contains('deck-sheet--full')).toBe(true)
    expect(sheet.querySelector('.builder-left')).not.toBeNull()

    fireEvent.click(within(sheet).getByRole('button', { name: t('common', 'close') }))
    expect(screen.queryByTestId('deck-phone-catalogue')).toBeNull()
  })

  it('DCK-14: Curve opens the numbers in a sheet', async () => {
    render(<DeckBuilder deckId="d1" onClose={vi.fn()} />)
    await screen.findByTestId('deck-editor-piles')

    fireEvent.click(screen.getByRole('button', { name: t('decks', 'phone_curve') }))
    const sheet = await screen.findByTestId('deck-phone-curve')
    expect(sheet.querySelector('.deck-numbers-panel')).not.toBeNull()
  })

  it('DCK-16: the more menu toggles separate creatures for the groupings that split, and the rows follow', async () => {
    render(<DeckBuilder deckId="d1" onClose={vi.fn()} />)
    await screen.findByTestId('deck-editor-piles')
    act(() => setSetting('deckStacksGroup', 'cmc'))

    fireEvent.click(screen.getByRole('button', { name: t('decks', 'editor_more') }))
    const menu = screen.getByRole('menu')
    fireEvent.click(within(menu).getByRole('menuitemcheckbox', { name: t('decks', 'toggle_separate_creatures') }))

    expect(document.querySelectorAll('.deck-editor-piles > .deck-editor-pile-row')).toHaveLength(2)
    expect(getState().settings.deckStacksSeparateCreatures).toBe(true)
  })

  it('DCK-16: the more menu hides separate creatures in Type grouping', async () => {
    render(<DeckBuilder deckId="d1" onClose={vi.fn()} />)
    await screen.findByTestId('deck-editor-piles')

    fireEvent.click(screen.getByRole('button', { name: t('decks', 'editor_more') }))
    expect(within(screen.getByRole('menu')).queryByRole('menuitemcheckbox', { name: t('decks', 'toggle_separate_creatures') })).toBeNull()
  })

  it('DCK-14: the more menu holds Import, Export, Sample hand, Equip and the card language', async () => {
    render(<DeckBuilder deckId="d1" onClose={vi.fn()} />)
    await screen.findByTestId('deck-editor-piles')
    expect(screen.queryByRole('menu')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: t('decks', 'editor_more') }))
    const menu = screen.getByRole('menu')
    for (const label of [t('decks', 'import_deck'), t('decks', 'builder_sample'), t('decks', 'builder_equip')]) {
      expect(within(menu).getByRole('menuitem', { name: label })).toBeTruthy()
    }
    for (const label of ['.dck', 'Arena', 'Plain', '.dek']) {
      expect(within(menu).getByRole('menuitem', { name: label })).toBeTruthy()
    }
    expect(within(menu).getByText(t('common', 'card_language'))).toBeTruthy()

    fireEvent.click(within(menu).getByRole('menuitem', { name: t('decks', 'import_deck') }))
    expect(document.querySelector('.deck-import-textarea')).not.toBeNull()
  })
})
