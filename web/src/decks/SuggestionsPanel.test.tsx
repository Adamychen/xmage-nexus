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

function makeCard(name: string): ScryfallSearchCard {
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
    ['sol ring', makeCard('Sol Ring')],
    ['arcane signet', makeCard('Arcane Signet')],
    ['llanowar elves', makeCard('Llanowar Elves')],
    ['elvish mystic', makeCard('Elvish Mystic')],
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
    expect(onAdd).toHaveBeenCalledWith(makeCard('Sol Ring'))
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
})
