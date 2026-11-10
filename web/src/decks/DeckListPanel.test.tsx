import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import DeckListPanel from './DeckListPanel'
import type { DeckCard } from '../lobby/decks'
import type { CardStripMeta } from './ArenaCardStrip'

const bolt: DeckCard = { cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 4 }
const reb: DeckCard = { cardName: 'Red Elemental Blast', setCode: '4ED', cardNumber: '218', amount: 2 }
const mountain: DeckCard = { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 20 }

const meta: CardStripMeta = {
  artCropUrl: null,
  imageUrl: null,
  backImageUrl: null,
  manaCost: '{R}',
  cmc: 1,
  typeLine: 'Instant',
  colors: ['R'],
}

function makeDataTransfer(payload?: unknown, effectAllowed = 'move') {
  return {
    files: [],
    dropEffect: 'none',
    effectAllowed,
    getData: (type: string) => (type === 'application/json' && payload ? JSON.stringify(payload) : ''),
  }
}

function renderPanel(overrides: Partial<Parameters<typeof DeckListPanel>[0]> = {}) {
  const onInc = vi.fn()
  const onDec = vi.fn()
  const onRemove = vi.fn()
  const onSetCover = vi.fn()
  const onDropCard = vi.fn()
  const onSwap = vi.fn()
  const props = {
    cards: [bolt, mountain],
    sideboard: [reb],
    coverKey: null,
    metaMap: new Map([
      ['M10/146', meta],
      ['LEA/292', meta],
      ['4ED/218', meta],
      ['lightning bolt', meta],
      ['mountain', meta],
      ['red elemental blast', meta],
    ]),
    onInc,
    onDec,
    onRemove,
    onSetCover,
    onDropCard,
    onSwap,
    ...overrides,
  }
  render(<DeckListPanel {...props} />)
  return { onInc, onDec, onDropCard, onSwap }
}

describe('DeckListPanel sideboard', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders the sideboard section with count and swap actions', () => {
    const { onSwap } = renderPanel({ format: 'Modern' })
    expect(screen.getByText(/Banquillo|Sideboard/i)).toBeDefined()
    expect(screen.getByText('2/15')).toBeDefined()
    const sideSection = document.querySelector('.deck-sideboard-section')
    expect(sideSection).not.toBeNull()
    const swapBtn = sideSection!.querySelector('.strip-btn.swap') as HTMLButtonElement
    expect(swapBtn).not.toBeNull()
    expect(swapBtn.title).toBe('Mover al mazo')
    fireEvent.click(swapBtn)
    expect(onSwap).toHaveBeenCalledWith('sb:4ED:218:Red Elemental Blast')
  })

  it('calls onSwap with sb: prefix for side strips and plain key for main strips', () => {
    const { onSwap } = renderPanel()
    const sideSection = document.querySelector('.deck-sideboard-section')!
    fireEvent.click(sideSection.querySelector('.strip-btn.swap')!)
    expect(onSwap).toHaveBeenCalledWith('sb:4ED:218:Red Elemental Blast')

    const mainSections = document.querySelectorAll('.deck-category-section:not(.deck-sideboard-section)')
    const mainStrip = Array.from(mainSections)
      .flatMap((s) => Array.from(s.querySelectorAll('.arena-card-strip')))
      .find((el) => el.textContent?.includes('Lightning Bolt'))!
    fireEvent.click(mainStrip.querySelector('.strip-btn.swap')!)
    expect(onSwap).toHaveBeenCalledWith('M10:146:Lightning Bolt')
  })

  it('drop over sideboard section routes to sideboard target and stops container propagation', () => {
    const { onDropCard } = renderPanel()
    const sideSection = document.querySelector('.deck-sideboard-section')!
    fireEvent.drop(sideSection, { dataTransfer: makeDataTransfer({ cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', source: 'main' }) })
    expect(onDropCard).toHaveBeenCalledTimes(1)
    expect(onDropCard).toHaveBeenCalledWith(expect.objectContaining({ cardName: 'Lightning Bolt' }), 'sideboard')
  })

  it('ignores drops of sideboard-origin cards on the sideboard section', () => {
    const { onDropCard } = renderPanel()
    const sideSection = document.querySelector('.deck-sideboard-section')!
    fireEvent.drop(sideSection, { dataTransfer: makeDataTransfer({ cardName: 'Red Elemental Blast', setCode: '4ED', cardNumber: '218', source: 'sideboard' }) })
    expect(onDropCard).not.toHaveBeenCalled()
  })

  it('main container drop still routes to main target', () => {
    const { onDropCard } = renderPanel()
    const container = document.querySelector('.arena-deck-list-container')!
    fireEvent.drop(container, { dataTransfer: makeDataTransfer({ cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', source: 'sideboard' }) })
    expect(onDropCard).toHaveBeenCalledWith(expect.objectContaining({ cardName: 'Lightning Bolt' }), 'main')
  })

  it('shows the sideboard section in horizontal layout too', () => {
    renderPanel({ layout: 'horizontal', format: 'Modern' })
    expect(document.querySelector('.arena-deck-cols-layout')).not.toBeNull()
    expect(document.querySelector('.deck-sideboard-section')).not.toBeNull()
    expect(screen.getByText('2/15')).toBeDefined()
  })

  it('Commander (sin banquillo) muestra el conteo sin límite ficticio', () => {
    renderPanel({ format: 'Commander' })
    expect(screen.getByText('2')).toBeDefined()
    expect(screen.queryByText('2/15')).toBeNull()
  })

  it('sets a dropEffect compatible with the drag source effectAllowed (Chrome drop-cancel guard)', () => {
    renderPanel()
    const sideSection = document.querySelector('.deck-sideboard-section')!
    const dtCopy = makeDataTransfer({ cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', source: 'search' }, 'copy')
    fireEvent.dragOver(sideSection, { dataTransfer: dtCopy })
    expect(dtCopy.dropEffect).toBe('copy')
    const dtMove = makeDataTransfer({ cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', source: 'main' }, 'move')
    fireEvent.dragOver(sideSection, { dataTransfer: dtMove })
    expect(dtMove.dropEffect).toBe('move')
    const container = document.querySelector('.arena-deck-list-container')!
    const dtContainer = makeDataTransfer({ cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', source: 'sideboard' }, 'move')
    fireEvent.dragOver(container, { dataTransfer: dtContainer })
    expect(dtContainer.dropEffect).toBe('move')
  })

  it('shows an empty drop hint when the sideboard is empty and still accepts drops', () => {
    const { onDropCard } = renderPanel({ sideboard: [] })
    expect(document.querySelector('.deck-sideboard-section')).not.toBeNull()
    expect(document.querySelector('.deck-sideboard-empty')).not.toBeNull()
    const sideSection = document.querySelector('.deck-sideboard-section')!
    fireEvent.drop(sideSection, { dataTransfer: makeDataTransfer({ cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', source: 'search' }) })
    expect(onDropCard).toHaveBeenCalledWith(expect.objectContaining({ cardName: 'Lightning Bolt' }), 'sideboard')
  })
})

describe('DeckListPanel commander drop', () => {
  afterEach(() => {
    cleanup()
  })

  it('routes a drop on the commander slot to the commander target (not main)', () => {
    const { onDropCard } = renderPanel({ isCommanderFormat: true })
    const section = document.querySelector('.deck-commander-section')!
    fireEvent.drop(section, { dataTransfer: makeDataTransfer({ cardName: "Atraxa, Praetors' Voice", setCode: '2XM', cardNumber: '190', source: 'main' }) })
    expect(onDropCard).toHaveBeenCalledTimes(1)
    expect(onDropCard).toHaveBeenCalledWith(expect.objectContaining({ cardName: "Atraxa, Praetors' Voice" }), 'commander')
  })

  it('shows the drop-here hint while dragging over the commander slot', () => {
    renderPanel({ isCommanderFormat: true })
    const section = document.querySelector('.deck-commander-section')!
    expect(section.textContent).toContain('Designa una carta legendaria')
    fireEvent.dragOver(section, { dataTransfer: makeDataTransfer({ cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', source: 'main' }) })
    expect(section.className).toContain('is-commander-drag-over')
    expect(section.textContent).toContain('Suelta aquí una carta legendaria')
  })

  it('flags a rejected drop with the invalid class', () => {
    const onDropCard = vi.fn(() => false)
    renderPanel({ isCommanderFormat: true, onDropCard })
    const section = document.querySelector('.deck-commander-section')!
    fireEvent.drop(section, { dataTransfer: makeDataTransfer({ cardName: 'Sol Ring', setCode: 'C16', cardNumber: '264', source: 'main' }) })
    expect(onDropCard).toHaveBeenCalledWith(expect.objectContaining({ cardName: 'Sol Ring' }), 'commander')
    expect(section.className).toContain('is-commander-drop-invalid')
  })

  it('does not render the commander slot outside commander formats', () => {
    renderPanel({ isCommanderFormat: false })
    expect(document.querySelector('.deck-commander-section')).toBeNull()
  })

  it('shows both commanders and routes the second crown to onSetPartner', () => {
    const sidar: DeckCard = { cardName: 'Sidar Kondo of Jamuraa', setCode: 'PC2', cardNumber: '1', amount: 1 }
    const tana: DeckCard = { cardName: 'Tana, the Bloodsower', setCode: 'C16', cardNumber: '56', amount: 1 }
    const onSetPartner = vi.fn()
    const partnerMeta: CardStripMeta = { keywords: ['Partner'], typeLine: 'Legendary Creature — Human' }
    renderPanel({
      isCommanderFormat: true,
      cards: [sidar, tana, mountain],
      commanderCard: sidar,
      partnerCard: tana,
      onSetCommander: vi.fn(),
      onSetPartner,
      metaMap: new Map([
        ['PC2/1', partnerMeta],
        ['C16/56', partnerMeta],
        ['sidar kondo of jamuraa', partnerMeta],
        ['tana, the bloodsower', partnerMeta],
        ['LEA/292', meta],
        ['mountain', meta],
      ]),
    })
    const section = document.querySelector('.deck-commander-section')!
    expect(section.querySelectorAll('.arena-card-strip')).toHaveLength(2)
    expect(section.querySelector('.deck-category-count')?.textContent).toBe('2')
    const crowns = section.querySelectorAll('.strip-btn.crown')
    expect(crowns).toHaveLength(2)
    fireEvent.click(crowns[1])
    expect(onSetPartner).toHaveBeenCalledWith(tana)
  })

  it('shows only the primary until a second commander is designated explicitly', () => {
    const sidar: DeckCard = { cardName: 'Sidar Kondo of Jamuraa', setCode: 'PC2', cardNumber: '1', amount: 1 }
    const tana: DeckCard = { cardName: 'Tana, the Bloodsower', setCode: 'C16', cardNumber: '56', amount: 1 }
    const partnerMeta: CardStripMeta = { keywords: ['Partner'], typeLine: 'Legendary Creature — Human' }
    renderPanel({
      isCommanderFormat: true,
      cards: [sidar, tana, mountain],
      commanderCard: sidar,
      metaMap: new Map([
        ['PC2/1', partnerMeta],
        ['C16/56', partnerMeta],
        ['sidar kondo of jamuraa', partnerMeta],
        ['tana, the bloodsower', partnerMeta],
        ['LEA/292', meta],
        ['mountain', meta],
      ]),
    })
    const section = document.querySelector('.deck-commander-section')!
    expect(section.querySelectorAll('.arena-card-strip')).toHaveLength(1)
    // La pareja legal sigue en el mazo general hasta que se designa el segundo
    const mainTana = document.querySelector('.deck-category-section:not(.deck-sideboard-section):not(.deck-commander-section) .arena-card-strip')
    expect(mainTana?.textContent).toContain('Tana')
  })
})

describe('DeckListPanel grouping', () => {
  afterEach(() => cleanup())

  const goblin: DeckCard = { cardName: 'Goblin Guide', setCode: 'ZEN', cardNumber: '126', amount: 1 }
  const krenko: DeckCard = { cardName: 'Krenko, Mob Boss', setCode: 'M13', cardNumber: '139', amount: 1 }
  const rarityMeta = (rarity: string, typeLine: string, cmc: number): CardStripMeta => ({ ...meta, rarity, typeLine, cmc })
  const metaMap = new Map<string, CardStripMeta>([
    ['M10/146', rarityMeta('common', 'Instant', 1)],
    ['LEA/292', rarityMeta('common', 'Basic Land — Mountain', 0)],
    ['ZEN/126', rarityMeta('rare', 'Creature — Goblin Scout', 1)],
    ['M13/139', rarityMeta('rare', 'Legendary Creature — Goblin Warrior', 4)],
    ['4ED/218', meta],
  ])
  const headers = () => [...document.querySelectorAll('.deck-category-header > span:first-child, .deck-col-title')].map((el) => el.textContent)

  it('DCK-25: the vertical list groups by the chosen grouping', () => {
    renderPanel({ cards: [bolt, mountain, goblin], metaMap, group: 'rarity' })
    expect(document.querySelector('[data-group="rare"]')?.textContent).toContain('Goblin Guide')
    expect(document.querySelector('[data-group="common"]')?.textContent).toContain('Lightning Bolt')
    expect(document.querySelector('[data-group="common"]')?.textContent).toContain('Mountain')
  })

  it('DCK-25: the horizontal list uses the same grouping, with the commander first', () => {
    renderPanel({
      cards: [krenko, bolt, mountain, goblin],
      metaMap,
      layout: 'horizontal',
      group: 'type',
      isCommanderFormat: true,
      format: 'Commander',
      commanderCard: krenko,
    })
    const columns = [...document.querySelectorAll('.deck-col')].map((el) => el.getAttribute('data-group'))
    expect(columns).toEqual(['commander', 'creatures', 'instants', 'lands'])
    expect(document.querySelector('[data-group="commander"]')?.textContent).toContain('Krenko, Mob Boss')
    expect(document.querySelector('[data-group="creatures"]')?.textContent).not.toContain('Krenko')
    expect(headers().length).toBeGreaterThan(0)
  })

  it('DCK-25: the free grouping lists the deck by its own piles, and by type until it has any', () => {
    const sectionIds = () => [...document.querySelectorAll('.deck-category-section[data-group]')].map((el) => el.getAttribute('data-group'))
    renderPanel({ cards: [bolt, goblin], metaMap, group: 'free' })
    expect(sectionIds()).toEqual(['creatures', 'instants'])
    cleanup()

    renderPanel({
      cards: [bolt, goblin],
      metaMap,
      group: 'free',
      piles: {
        piles: [{ id: 'p1', label: 'Burn' }, { id: 'p2', label: 'Beaters' }],
        assign: { 'M10:146:Lightning Bolt': { p1: 4 }, 'ZEN:126:Goblin Guide': { p2: 1 } },
      },
    })
    expect(sectionIds()).toEqual(['p1', 'p2'])
    expect(document.querySelector('[data-group="p1"]')?.textContent).toContain('Burn')
    expect(document.querySelector('[data-group="p1"]')?.textContent).toContain('Lightning Bolt')
    expect(document.querySelector('[data-group="p2"]')?.textContent).toContain('Goblin Guide')
  })
})
