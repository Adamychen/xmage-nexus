import { describe, expect, it, afterEach, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ArenaCardGrid } from './ArenaCardGrid'
import type { ScryfallSearchCard } from './scryfallSearch'

const makeCard = (name: string, over: Partial<ScryfallSearchCard> = {}) =>
  ({ name, set: 'm10', collector_number: String(name.length), type_line: 'Instant', colors: ['R'], ...over }) as unknown as ScryfallSearchCard

describe('ArenaCardGrid drag payload (AUDIT bloqueante)', () => {
  afterEach(() => {
    cleanup()
  })

  it('envía el type_line canónico aunque la impresión sea localizada', () => {
    const card = {
      name: 'Sidar Kondo of Jamuraa',
      printed_name: 'Sidar Kondo de Jamuraa',
      set: 'pc2',
      collector_number: '1',
      type_line: 'Legendary Creature — Human',
      printed_type_line: 'Criatura legendaria — Humano',
      oracle_text: 'Partner',
      colors: ['G', 'W'],
      lang: 'es',
    } as unknown as ScryfallSearchCard

    const { container } = render(
      <ArenaCardGrid
        cards={[card]}
        loading={false}
        error={null}
        countMap={new Map()}
        onAdd={() => {}}
      />,
    )
    const el = container.querySelector('.arena-grid-card.search-card')
    expect(el).not.toBeNull()
    const store: Record<string, string> = {}
    fireEvent.dragStart(el!, {
      dataTransfer: { setData: (k: string, v: string) => { store[k] = v }, effectAllowed: '' },
    } as unknown as DataTransfer)
    const payload = JSON.parse(store['application/json'])
    expect(payload.typeLine).toBe('Legendary Creature — Human')
  })
})

describe('ArenaCardGrid UX (auditoría)', () => {
  afterEach(() => {
    cleanup()
  })

  it('añade la carta con Enter (operable por teclado)', () => {
    const onAdd = vi.fn()
    render(
      <ArenaCardGrid cards={[makeCard('Lightning Bolt')]} loading={false} error={null} countMap={new Map()} onAdd={onAdd} />,
    )
    const el = document.querySelector('.arena-grid-card.search-card')!
    fireEvent.keyDown(el, { key: 'Enter' })
    expect(onAdd).toHaveBeenCalledOnce()
  })

  it('sin resultados muestra la búsqueda y permite limpiar filtros', () => {
    const onClearFilters = vi.fn()
    render(
      <ArenaCardGrid
        cards={[]}
        loading={false}
        error={null}
        totalCards={0}
        query="t:dragon"
        countMap={new Map()}
        onAdd={vi.fn()}
        onClearFilters={onClearFilters}
      />,
    )
    expect(screen.getByText(/t:dragon/)).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /Limpiar filtros/i }))
    expect(onClearFilters).toHaveBeenCalledOnce()
  })

  it('el error de red ofrece reintento', () => {
    const onRetry = vi.fn()
    render(
      <ArenaCardGrid cards={[]} loading={false} error="Scryfall 500" countMap={new Map()} onAdd={vi.fn()} onRetry={onRetry} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/i }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('más de 4 copias muestran contador numérico', () => {
    const card = makeCard('Lightning Bolt')
    const countMap = new Map([[`M10/${card.collector_number}`, 6], ['lightning bolt', 6]])
    render(<ArenaCardGrid cards={[card]} loading={false} error={null} countMap={countMap} onAdd={vi.fn()} />)
    expect(document.querySelector('.card-pip-count')?.textContent).toBe('6×')
  })
})
