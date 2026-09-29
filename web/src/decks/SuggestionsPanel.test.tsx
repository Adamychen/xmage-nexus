import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SuggestionsPanel from './SuggestionsPanel'
import { fetchEdhrecCommander, resolveCardsByNames } from './edhrec'
import type { ScryfallSearchCard } from './scryfallSearch'
import { setLanguage } from '../i18n'

vi.mock('./edhrec', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./edhrec')>()
  return {
    ...actual,
    fetchEdhrecCommander: vi.fn(),
    resolveCardsByNames: vi.fn(),
  }
})

const fetchMock = vi.mocked(fetchEdhrecCommander)
const resolveMock = vi.mocked(resolveCardsByNames)

function makeCard(name: string, over: Partial<ScryfallSearchCard> = {}): ScryfallSearchCard {
  return {
    id: `id-${name}`,
    name,
    set: 'tst',
    collector_number: '1',
    cmc: 1,
    type_line: 'Artifact',
    colors: [],
    color_identity: [],
    image_uris: { small: 'https://img/s.png', normal: 'https://img/n.png', art_crop: 'https://img/a.png' },
    ...over,
  }
}

const EDHREC_OK = {
  status: 'ok' as const,
  data: {
    slug: 'test-commander',
    commanderName: 'Test Commander',
    numDecks: 4321,
    lists: [
      {
        tag: 'highsynergycards',
        header: 'High Synergy Cards',
        cards: [
          { name: 'Sol Ring', synergy: 0.25, numDecks: 100, potentialDecks: 1000 },
          { name: 'Arcane Signet', synergy: -0.1, numDecks: 90, potentialDecks: 1000 },
        ],
      },
      {
        tag: 'creatures',
        header: 'Creatures',
        cards: [{ name: 'Llanowar Elves', synergy: 0.05, numDecks: 50, potentialDecks: 1000 }],
      },
      {
        tag: 'tribalstuff',
        header: 'Elves',
        cards: [{ name: 'Elvish Mystic', synergy: 0.02, numDecks: 40, potentialDecks: 1000 }],
      },
    ],
  },
}

function resolvedMap() {
  return new Map<string, ScryfallSearchCard>([
    ['sol ring', makeCard('Sol Ring', { collector_number: '999', cmc: 1, rarity: 'uncommon' })],
    ['arcane signet', makeCard('Arcane Signet', { cmc: 2, rarity: 'common' })],
    ['llanowar elves', makeCard('Llanowar Elves', { type_line: 'Creature — Elf Druid', color_identity: ['G'], rarity: 'common' })],
    ['elvish mystic', makeCard('Elvish Mystic', { type_line: 'Creature — Elf Druid', color_identity: ['G'], rarity: 'common' })],
  ])
}

beforeEach(() => {
  setLanguage('en')
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

describe('SuggestionsPanel', () => {
  it('shows the format hint when the deck is not a commander format', () => {
    render(
      <SuggestionsPanel
        commanderName="Test Commander"
        isCommanderFormat={false}
        countMap={new Map()}
        onAdd={() => {}}
      />,
    )
    expect(screen.getByTestId('sg-not-commander')).not.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows the designate hint when no commander is designated', () => {
    render(
      <SuggestionsPanel
        commanderName={null}
        isCommanderFormat
        countMap={new Map()}
        onAdd={() => {}}
      />,
    )
    expect(screen.getByTestId('sg-need-commander')).not.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('renders sections, synergy badges and adds cards on click', async () => {
    fetchMock.mockResolvedValue(EDHREC_OK)
    resolveMock.mockResolvedValue(resolvedMap())
    const onAdd = vi.fn()
    render(
      <SuggestionsPanel
        commanderName="Test Commander"
        isCommanderFormat
        countMap={new Map([['sol ring', 1]])}
        onAdd={onAdd}
      />,
    )

    const solRing = await screen.findByAltText('Sol Ring')
    expect(solRing).not.toBeNull()
    expect(screen.getByText('High synergy')).not.toBeNull()
    expect(screen.getByText('Creatures')).not.toBeNull()
    expect(screen.getByText('Elves')).not.toBeNull()
    expect(screen.getByText('+25%')).not.toBeNull()
    expect(screen.getByText('Based on 4,321 Test Commander decks')).not.toBeNull()
    expect(resolveMock).toHaveBeenCalledWith(['Sol Ring', 'Arcane Signet', 'Llanowar Elves', 'Elvish Mystic'])

    fireEvent.click(solRing.closest('[role="button"]')!)
    expect(onAdd).toHaveBeenCalledWith(makeCard('Sol Ring', { collector_number: '999', cmc: 1, rarity: 'uncommon' }))
  })

  it('marks cards already in the deck with a gold badge and pulses when the count grows', async () => {
    fetchMock.mockResolvedValue(EDHREC_OK)
    resolveMock.mockResolvedValue(resolvedMap())
    const baseProps = {
      commanderName: 'Test Commander',
      isCommanderFormat: true,
      onAdd: () => {},
    }
    const { rerender } = render(<SuggestionsPanel {...baseProps} countMap={new Map()} />)
    await screen.findByAltText('Sol Ring')
    const tile = () => screen.getByAltText('Sol Ring').closest('[role="button"]') as HTMLElement

    expect(tile().className).not.toContain('is-in-deck')
    expect(tile().querySelector('[data-testid="sg-in-deck-badge"]')).toBeNull()

    rerender(<SuggestionsPanel {...baseProps} countMap={new Map([['TST/999', 1], ['sol ring', 2]])} />)

    expect(tile().className).toContain('is-in-deck')
    expect(tile().className).toContain('is-pulsing')
    expect(tile().querySelector('[data-testid="sg-in-deck-badge"]')?.textContent).toContain('×2')
    expect(tile().getAttribute('title')).toContain('In deck ×2')
    expect(screen.getByAltText('Arcane Signet').closest('[role="button"]')?.className).not.toContain('is-in-deck')
  })

  it('shows not_found for commanders without EDHREC data', async () => {
    fetchMock.mockResolvedValue({ status: 'not_found' })
    render(
      <SuggestionsPanel
        commanderName="Obscure Dude"
        isCommanderFormat
        countMap={new Map()}
        onAdd={() => {}}
      />,
    )
    expect(await screen.findByTestId('sg-not-found')).not.toBeNull()
    expect(resolveMock).not.toHaveBeenCalled()
  })

  it('shows an error with retry that refetches', async () => {
    fetchMock.mockResolvedValueOnce({ status: 'error' })
    render(
      <SuggestionsPanel
        commanderName="Test Commander"
        isCommanderFormat
        countMap={new Map()}
        onAdd={() => {}}
      />,
    )
    const retry = await screen.findByRole('button', { name: 'Retry' })
    fetchMock.mockResolvedValue(EDHREC_OK)
    resolveMock.mockResolvedValue(resolvedMap())
    fireEvent.click(retry)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(await screen.findByAltText('Sol Ring')).not.toBeNull()
  })

  it('filters the suggestions with the type chips and the raw query', async () => {
    fetchMock.mockResolvedValue(EDHREC_OK)
    resolveMock.mockResolvedValue(resolvedMap())
    render(
      <SuggestionsPanel
        commanderName="Test Commander"
        isCommanderFormat
        countMap={new Map()}
        onAdd={() => {}}
      />,
    )
    await screen.findByAltText('Sol Ring')
    expect(screen.getByAltText('Llanowar Elves')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Creature' }))
    expect(screen.queryByAltText('Sol Ring')).toBeNull()
    expect(screen.queryByAltText('Arcane Signet')).toBeNull()
    expect(screen.getByAltText('Llanowar Elves')).not.toBeNull()
    expect(screen.getByAltText('Elvish Mystic')).not.toBeNull()

    fireEvent.change(screen.getByPlaceholderText(/Search by name/), { target: { value: 't:artifact' } })
    expect(screen.getByTestId('sg-no-results')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.queryByTestId('sg-no-results')).toBeNull()
    expect(screen.getByAltText('Sol Ring')).not.toBeNull()
  })

  it('filters by colorless with the mana orb', async () => {
    fetchMock.mockResolvedValue(EDHREC_OK)
    resolveMock.mockResolvedValue(resolvedMap())
    render(
      <SuggestionsPanel
        commanderName="Test Commander"
        isCommanderFormat
        countMap={new Map()}
        onAdd={() => {}}
      />,
    )
    await screen.findByAltText('Sol Ring')
    fireEvent.click(screen.getByRole('button', { name: 'Colorless' }))
    expect(screen.getByAltText('Sol Ring')).not.toBeNull()
    expect(screen.getByAltText('Arcane Signet')).not.toBeNull()
    expect(screen.queryByAltText('Llanowar Elves')).toBeNull()
  })

  it('sorts within each section with the sort control', async () => {
    fetchMock.mockResolvedValue(EDHREC_OK)
    resolveMock.mockResolvedValue(resolvedMap())
    render(
      <SuggestionsPanel
        commanderName="Test Commander"
        isCommanderFormat
        countMap={new Map()}
        onAdd={() => {}}
      />,
    )
    await screen.findByAltText('Sol Ring')
    const sectionNames = () => {
      const section = screen.getByText('High synergy').closest('.sg-section')!
      return [...section.querySelectorAll('img')].map((img) => img.getAttribute('alt'))
    }
    expect(sectionNames()).toEqual(['Sol Ring', 'Arcane Signet'])

    fireEvent.change(screen.getByRole('combobox', { name: 'Sort' }), { target: { value: 'name' } })
    expect(sectionNames()).toEqual(['Arcane Signet', 'Sol Ring'])
  })

  it('applies the shared card size to the suggestion grids', async () => {
    fetchMock.mockResolvedValue(EDHREC_OK)
    resolveMock.mockResolvedValue(resolvedMap())
    const onGridSizeChange = vi.fn()
    render(
      <SuggestionsPanel
        commanderName="Test Commander"
        isCommanderFormat
        countMap={new Map()}
        onAdd={() => {}}
        gridSize={50}
        onGridSizeChange={onGridSizeChange}
      />,
    )
    await screen.findByAltText('Sol Ring')
    const panel = document.querySelector('.sg-panel') as HTMLElement
    expect(panel.style.getPropertyValue('--sg-card-min')).toBe('140px')

    fireEvent.change(document.querySelector('.arena-grid-size-slider')!, { target: { value: '150' } })
    expect(onGridSizeChange).toHaveBeenCalledWith(150)
  })
})
