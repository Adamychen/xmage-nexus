import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { t } from '../i18n'

const searchQueries = vi.hoisted(() => [] as string[])
vi.mock('./scryfallSearch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./scryfallSearch')>()),
  useScryfallSearch: (query: string) => {
    searchQueries.push(query)
    return { cards: [], loading: false, loadingMore: false, hasMore: false, totalCards: undefined, error: null, throttled: false, loadMore: () => {}, retry: () => {} }
  },
}))
vi.mock('./useXmageImplemented', () => ({ useXmageUnimplemented: () => new Set<string>() }))

const { default: SearchPanel } = await import('./SearchPanel')

afterEach(() => {
  cleanup()
  searchQueries.length = 0
})

describe('SearchPanel', () => {
  it('DCK-21: opening the search asks Scryfall for nothing and says how to start', () => {
    render(<SearchPanel onAdd={() => {}} format="Commander" />)

    expect(searchQueries.length).toBeGreaterThan(0)
    expect(searchQueries.every((q) => q === '')).toBe(true)
    expect(screen.getByText(t('decks', 'builder_search_hint'))).not.toBeNull()
    expect(document.querySelector('.arena-grid-footer')).toBeNull()
  })

  it('DCK-21: typing a name or picking a filter starts the search', () => {
    render(<SearchPanel onAdd={() => {}} format="Commander" />)

    fireEvent.change(screen.getByPlaceholderText(t('decks', 'filter_search_placeholder')), { target: { value: 'bolt' } })
    expect(searchQueries.at(-1)).toBe('bolt f:commander')
    expect(document.querySelector('.arena-grid-count')?.textContent).toBe(t('decks', 'grid_of_total', { shown: '0', total: '0' }))

    fireEvent.change(screen.getByPlaceholderText(t('decks', 'filter_search_placeholder')), { target: { value: '' } })
    expect(searchQueries.at(-1)).toBe('')

    fireEvent.click(screen.getByRole('button', { name: t('game', 'color_red') }))
    expect(searchQueries.at(-1)).toContain('game:paper -t:basic f:commander')
  })

  it('DCK-24: rules text alone starts the search with Scryfall o: terms', () => {
    render(<SearchPanel onAdd={() => {}} format="Commander" />)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('decks', 'filter_advanced')) }))
    fireEvent.change(screen.getByRole('searchbox', { name: t('decks', 'filter_oracle') }), { target: { value: '"enters tapped" draw' } })
    expect(searchQueries.at(-1)).toBe('game:paper -t:basic f:commander o:"enters tapped" o:"draw"')
  })
})
