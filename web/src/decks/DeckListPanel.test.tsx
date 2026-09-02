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
    const { onSwap } = renderPanel()
    expect(screen.getByText(/Sideboard/i)).toBeDefined()
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
    renderPanel({ layout: 'horizontal' })
    expect(document.querySelector('.arena-deck-cols-layout')).not.toBeNull()
    expect(document.querySelector('.deck-sideboard-section')).not.toBeNull()
    expect(screen.getByText('2/15')).toBeDefined()
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
