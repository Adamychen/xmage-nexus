import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { CardPrintingsModal, parseScryfallPrints } from './CardPrintingsModal'
import { setCustomCardArtDataUrl, resetCustomCardArtCache } from '../cards/customCardArt'

describe('CardPrintingsModal', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    resetCustomCardArtCache()
  })

  const mockPrintsData = {
    data: [
      {
        id: 'print-1',
        set: 'dmu',
        set_name: 'Dominaria United',
        collector_number: '137',
        released_at: '2022-09-09',
        rarity: 'uncommon',
        image_uris: { normal: 'https://cards.scryfall.io/dmu-137.jpg' },
      },
      {
        id: 'print-2',
        set: 'm10',
        set_name: 'Magic 2010',
        collector_number: '146',
        released_at: '2009-07-17',
        rarity: 'common',
        image_uris: { normal: 'https://cards.scryfall.io/m10-146.jpg' },
      },
    ],
  }

  it('parses Scryfall prints response correctly', () => {
    const prints = parseScryfallPrints(mockPrintsData)
    expect(prints).toHaveLength(2)
    expect(prints[0].set).toBe('DMU')
    expect(prints[0].setName).toBe('Dominaria United')
    expect(prints[0].collectorNumber).toBe('137')
    expect(prints[1].set).toBe('M10')
  })

  it('renders printings grid and allows selecting an edition', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPrintsData,
    }) as any

    const onSelect = vi.fn()
    const onClose = vi.fn()

    render(
      <CardPrintingsModal
        cardName="Lightning Bolt"
        currentSet="M10"
        currentNumber="146"
        onSelectPrinting={onSelect}
        onClose={onClose}
      />
    )

    expect(screen.getByText('Seleccionar Edición & Arte')).toBeDefined()
    expect(screen.getByText('Lightning Bolt')).toBeDefined()

    await waitFor(() => {
      expect(screen.getByText('Dominaria United')).toBeDefined()
    })

    const dmuCard = screen.getByText('Dominaria United')
    fireEvent.click(dmuCard)

    expect(onSelect).toHaveBeenCalledWith('DMU', '137')
    expect(onClose).toHaveBeenCalled()
  })

  it('shows the uploaded custom image and removes it from the custom art section', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPrintsData,
    }) as any

    render(
      <CardPrintingsModal
        cardName="Lightning Bolt"
        currentSet="M10"
        currentNumber="146"
        onSelectPrinting={vi.fn()}
        onClose={vi.fn()}
      />
    )

    const section = screen.getByTestId('custom-art-section')
    expect(section).toBeDefined()
    expect(screen.getByText('Subir imagen')).toBeDefined()

    setCustomCardArtDataUrl('Lightning Bolt', 'data:image/jpeg;base64,CUSTOM')
    await waitFor(() => {
      expect(section.querySelector('img.custom-art-thumb')).not.toBeNull()
    })
    expect(section.querySelector('img.custom-art-thumb')!.getAttribute('src')).toBe('data:image/jpeg;base64,CUSTOM')

    fireEvent.click(screen.getByLabelText('Quitar imagen'))
    await waitFor(() => {
      expect(section.querySelector('img.custom-art-thumb')).toBeNull()
    })
    expect(screen.getByText('Subir imagen')).toBeDefined()
  })
})
