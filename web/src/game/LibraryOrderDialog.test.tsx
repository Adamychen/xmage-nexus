import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LibraryOrderDialog from './LibraryOrderDialog'
import type { FeedbackPrompt } from './feedback'

describe('LibraryOrderDialog', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders top of library cards in the Arena fan', () => {
    const send = vi.fn()
    const cancel = vi.fn()

    const prompt: FeedbackPrompt = {
      method: 'GAME_CHOOSE_CARDS_ORDER',
      gameId: 'g-1',
      title: 'Adivinar (Scry 3)',
      message: 'Pon las cartas arriba o en el fondo de la biblioteca en el orden deseado.',
      mode: 'order',
      options: [
        { id: 'card-1', label: 'Lightning Bolt', value: 'card-1' },
        { id: 'card-2', label: 'Counterspell', value: 'card-2' },
        { id: 'card-3', label: 'Brainstorm', value: 'card-3' },
      ],
      min: 0,
      max: 3,
    }

    const { container, getByText, getAllByText } = render(
      <LibraryOrderDialog prompt={prompt} send={send} cancel={cancel} busy={false} />,
    )

    expect(getByText('Adivinar (Scry 3)')).not.toBeNull()
    expect(getAllByText('Lightning Bolt').length).toBeGreaterThanOrEqual(1)
    expect(getAllByText('Counterspell').length).toBeGreaterThanOrEqual(1)
    expect(getAllByText('Brainstorm').length).toBeGreaterThanOrEqual(1)

    const topIds = [...container.querySelectorAll('[data-arena-zone="top"] [data-arena-card]')].map((el) =>
      el.getAttribute('data-arena-card'),
    )
    expect(topIds).toEqual(['card-1', 'card-2', 'card-3'])
  })

  it('moves cards between top and bottom zones and handles quick buttons', () => {
    const send = vi.fn()
    const cancel = vi.fn()

    const prompt: FeedbackPrompt = {
      method: 'GAME_CHOOSE_CARDS_ORDER',
      gameId: 'g-1',
      title: 'Scry 2',
      message: 'Scry 2',
      mode: 'order',
      options: [
        { id: 'card-1', label: 'Lightning Bolt', value: 'card-1' },
        { id: 'card-2', label: 'Counterspell', value: 'card-2' },
      ],
      min: 0,
      max: 2,
    }

    const { getByText } = render(
      <LibraryOrderDialog prompt={prompt} send={send} cancel={cancel} busy={false} />,
    )

    // Send all to bottom
    const allToBottomBtn = getByText('Todas al fondo')
    fireEvent.click(allToBottomBtn)

    expect(getByText('Confirmar orden (0 arriba, 2 fondo)')).not.toBeNull()

    // Send all back to top
    const allToTopBtn = getByText('Todas arriba')
    fireEvent.click(allToTopBtn)

    expect(getByText('Confirmar orden (2 arriba, 0 fondo)')).not.toBeNull()

    // Click confirm
    const confirmBtn = getByText('Confirmar orden (2 arriba, 0 fondo)')
    fireEvent.click(confirmBtn)
    expect(send).toHaveBeenCalled()
  })

  it('detects Surveil and changes bottom zone label to Graveyard', () => {
    const send = vi.fn()
    const cancel = vi.fn()

    const prompt: FeedbackPrompt = {
      method: 'GAME_CHOOSE_CARDS_ORDER',
      gameId: 'g-1',
      title: 'Surveil 1',
      message: 'Surveil 1: You may put the card into your graveyard.',
      mode: 'order',
      options: [
        { id: 'card-consider', label: 'Consider', value: 'card-consider' },
      ],
      min: 0,
      max: 1,
    }

    const { getByText } = render(
      <LibraryOrderDialog prompt={prompt} send={send} cancel={cancel} busy={false} />,
    )

    expect(getByText('Todas al cementerio')).not.toBeNull()
  })

  it('handles cancel button click', () => {
    const send = vi.fn()
    const cancel = vi.fn()

    const prompt: FeedbackPrompt = {
      method: 'GAME_CHOOSE_CARDS_ORDER',
      gameId: 'g-1',
      title: 'Order Cards',
      message: 'Choose card order',
      mode: 'order',
      options: [{ id: 'card-1', label: 'Card 1', value: 'card-1' }],
      min: 0,
      max: 1,
    }

    const { getByText } = render(
      <LibraryOrderDialog prompt={prompt} send={send} cancel={cancel} busy={false} />,
    )

    const cancelBtn = getByText('Cancelar')
    fireEvent.click(cancelBtn)
    expect(cancel).toHaveBeenCalled()
  })
})
