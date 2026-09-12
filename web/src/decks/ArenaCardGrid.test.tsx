import { describe, expect, it, afterEach } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { ArenaCardGrid } from './ArenaCardGrid'
import type { ScryfallSearchCard } from './scryfallSearch'

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
