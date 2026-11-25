import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PileOverlay from './PileOverlay'
import type { CardView } from '../net/types'

afterEach(cleanup)

describe('PileOverlay', () => {
  it('renders graveyard / exile cards list with close button', () => {
    const onClose = vi.fn()
    const cards: Record<string, CardView> = {
      'c-1': { id: 'c-1', name: 'Lightning Bolt', manaValue: 1 },
      'c-2': { id: 'c-2', name: 'Counterspell', manaValue: 2 },
    }

    const { getByText, getByTitle } = render(
      <PileOverlay title="Cementerio" cards={cards} onClose={onClose} />
    )

    expect(getByText('Cementerio')).not.toBeNull()
    expect(getByText('2 cartas')).not.toBeNull()
    const closeBtn = getByTitle('Cerrar (Esc)')
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalled()
  })

  it('BRD-24: pointing at a card opens no side preview panel', () => {
    render(
      <PileOverlay
        title="Cementerio"
        cards={{ 'c-1': { id: 'c-1', name: 'Lightning Bolt', manaValue: 1 } }}
        onClose={vi.fn()}
      />
    )
    const card = document.querySelector('.zone-fan-item .pile-card') as HTMLElement
    fireEvent.mouseEnter(card)
    fireEvent.mouseOver(card)
    expect(document.querySelector('.floating-card-preview')).toBeNull()
    expect(document.querySelector('.prompt-card-zoomable')).toBeNull()
  })

  it('uses singular for a single card', () => {
    const { getByText } = render(
      <PileOverlay
        title="Cementerio"
        cards={{ 'c-1': { id: 'c-1', name: 'Lightning Bolt', manaValue: 1 } }}
        onClose={vi.fn()}
      />
    )

    expect(getByText('1 carta')).not.toBeNull()
  })

  it('BRD-24: renders a library with its revealed top card, face-down cards, no numbers and Bottom/Top at its ends', () => {
    const onClose = vi.fn()
    const cards: Record<string, CardView> = {
      'lib-top': {
        id: 'lib-top',
        name: 'Delver of Secrets',
        manaValue: 1,
        faceDown: false,
      },
      'lib-2': {
        id: 'lib-2',
        name: 'Carta #2',
        manaValue: 0,
        faceDown: true,
      },
      'lib-3': {
        id: 'lib-3',
        name: 'Carta #3',
        manaValue: 0,
        faceDown: true,
      },
    }

    const { getByText } = render(
      <PileOverlay
        title="Biblioteca de Jugador"
        cards={cards}
        onClose={onClose}
        isLibrary={true}
      />
    )

    expect(getByText('Biblioteca de Jugador')).not.toBeNull()
    expect(getByText('3 cartas')).not.toBeNull()
    expect(document.body.textContent).toContain('1 revelado')
    expect(document.body.textContent).not.toMatch(/#\d/)
    expect([...document.body.querySelectorAll('.zone-fan-end')].map((el) => el.textContent)).toEqual(['Abajo', 'Arriba'])
    expect(getByText('Delver of Secrets')).not.toBeNull()
    const backImages = document.body.querySelectorAll('img[src="https://cards.scryfall.io/back.png"]')
    expect(backImages.length).toBeGreaterThanOrEqual(2)
  })

  it('closes on Escape key press', () => {
    const onClose = vi.fn()
    render(<PileOverlay title="Exilio" cards={{}} onClose={onClose} />)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('TGT-5: lets a graveyard/exile card be clicked when it is a valid target', () => {
    const onTargetClick = vi.fn()
    const cards: Record<string, CardView> = {
      'c-1': { id: 'c-1', name: 'Lightning Bolt', manaValue: 1 },
    }

    render(
      <PileOverlay
        title="Cementerio"
        cards={cards}
        onClose={vi.fn()}
        targetIds={new Set(['c-1'])}
        onTargetClick={onTargetClick}
      />
    )

    fireEvent.click(document.body.querySelector('.pile-card')!)
    expect(onTargetClick).toHaveBeenCalledWith('c-1')
  })

  it('TGT-5: does not attach a click handler for a non-target, non-playable card', () => {
    const onTargetClick = vi.fn()
    const onPlayCard = vi.fn()
    const cards: Record<string, CardView> = {
      'c-1': { id: 'c-1', name: 'Lightning Bolt', manaValue: 1 },
    }

    render(
      <PileOverlay
        title="Cementerio"
        cards={cards}
        onClose={vi.fn()}
        targetIds={new Set(['other-id'])}
        onTargetClick={onTargetClick}
        onPlayCard={onPlayCard}
      />
    )

    fireEvent.click(document.body.querySelector('.pile-card')!)
    expect(onTargetClick).not.toHaveBeenCalled()
    expect(onPlayCard).not.toHaveBeenCalled()
  })
})

describe('PileOverlay, a pile longer than the fan', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  const narrowFan = () => {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('zone-fan-item') ? 100 : 0
    })
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('zone-fan-item') ? 140 : 0
    })
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('zone-fan') ? 500 : 0
    })
  }
  const onFan = (el: Element) => !el.classList.contains('is-piled') && !el.classList.contains('is-off-fan')
  const fanItems = () => [...document.body.querySelectorAll<HTMLElement>('.zone-fan-item')]

  it('BRD-24: a graveyard opens slid to its right end, on the card put there last', () => {
    narrowFan()
    const cards: Record<string, CardView> = Object.fromEntries(
      Array.from({ length: 14 }, (_, i) => [`g-${i}`, { id: `g-${i}`, name: `Card ${i}`, manaValue: 1 }]),
    )
    render(<PileOverlay title="Cementerio" cards={cards} onClose={vi.fn()} />)
    const items = fanItems()
    expect(items.at(-1)!.textContent).toContain('Card 13')
    expect(onFan(items.at(-1)!), 'the top of the graveyard is on the fan').toBe(true)
    expect(onFan(items[0]), 'the oldest card waits in the left pile').toBe(false)
  })

  it('BRD-24: a library draws its top card, #1, at the right end and opens there', () => {
    narrowFan()
    const cards: Record<string, CardView> = Object.fromEntries(
      Array.from({ length: 14 }, (_, i) => [`l-${i + 1}`, { id: `l-${i + 1}`, name: `Card ${i + 1}`, manaValue: 0, faceDown: i > 0 }]),
    )
    render(<PileOverlay title="Biblioteca" cards={cards} onClose={vi.fn()} isLibrary />)
    const items = fanItems()
    expect(items.at(-1)!.classList.contains('is-top-card')).toBe(true)
    expect(items[0].classList.contains('is-top-card')).toBe(false)
    expect(onFan(items.at(-1)!), 'the top of the library is on the fan').toBe(true)
    expect(onFan(items[0]), 'the bottom of the library waits in the left pile').toBe(false)
  })

  it('BRD-24: revealed cards listed from the first one draw that one at the right end', () => {
    const cards: Record<string, CardView> = {
      'r-1': { id: 'r-1', name: 'First', manaValue: 1 },
      'r-2': { id: 'r-2', name: 'Second', manaValue: 1 },
    }
    render(<PileOverlay title="Revelado" cards={cards} onClose={vi.fn()} listedFromTop />)
    expect(fanItems().map((el) => el.textContent)).toEqual([expect.stringContaining('Second'), expect.stringContaining('First')])
    expect([...document.body.querySelectorAll('.zone-fan-end')].map((el) => el.textContent)).toEqual(['Última', 'Primera'])
  })
})
