import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import DecksGallery, { cloneDeckForEdit, mergeEnrichedColors, pruneSelectedId } from './DecksGallery'
import type { DeckV2 } from './types'

const storeState = vi.hoisted(() => ({ decks: [] as DeckV2[] }))
const confirmState = vi.hoisted(() => ({ calls: [] as string[], resolve: true }))

vi.mock('./storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./storage')>()
  return {
    ...actual,
    getDeckStorage: () => ({
      list: async () => [...storeState.decks],
      get: async (id: string) => storeState.decks.find((d) => d.id === id) ?? null,
      put: async (d: DeckV2) => {
        const i = storeState.decks.findIndex((x) => x.id === d.id)
        if (i >= 0) storeState.decks[i] = d
        else storeState.decks.unshift(d)
      },
      del: async (id: string) => {
        storeState.decks = storeState.decks.filter((d) => d.id !== id)
      },
      count: async () => storeState.decks.length,
    }),
  }
})

vi.mock('../ui/confirmDialog', () => ({
  confirmDialog: vi.fn(async (msg: string) => {
    confirmState.calls.push(msg)
    return confirmState.resolve
  }),
  alertDialog: vi.fn(async () => undefined),
}))

const customDeck = (over: Partial<DeckV2> = {}): DeckV2 => ({
  id: 'c1',
  name: 'Mi Burn',
  format: 'Freeform',
  colors: ['R'],
  cards: [{ cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 4 }],
  sideboard: [],
  createdAt: 1,
  updatedAt: 2,
  source: 'custom',
  ...over,
}) as DeckV2

beforeEach(() => {
  storeState.decks = []
  confirmState.calls = []
  confirmState.resolve = true
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false }) as never))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('cloneDeckForEdit (AUDIT bloqueante)', () => {
  it('conserva comandante, pareja y favorito al clonar un precon Commander', () => {
    const atraxa = { cardName: "Atraxa, Praetors' Voice", setCode: 'C16', cardNumber: '28', amount: 1 }
    const sidar = { cardName: 'Sidar Kondo of Jamuraa', setCode: 'PC2', cardNumber: '1', amount: 1 }
    const tana = { cardName: 'Tana, the Bloodsower', setCode: 'C16', cardNumber: '56', amount: 1 }
    const precon = {
      id: 'precon-0-x',
      name: 'CMD',
      format: 'Commander',
      colors: ['W', 'U', 'B', 'G'],
      cards: [atraxa],
      sideboard: [],
      coverCard: atraxa,
      commanderCard: sidar,
      partnerCard: tana,
      favorite: true,
      createdAt: 1,
      updatedAt: 1,
      source: 'precon',
    } as unknown as DeckV2

    const clone = cloneDeckForEdit(precon)
    expect(clone.id).not.toBe(precon.id)
    expect(clone.source).toBe('custom')
    expect(clone.commanderCard).toEqual(sidar)
    expect(clone.partnerCard).toEqual(tana)
    expect(clone.favorite).toBe(true)
    expect(clone.coverCard).toEqual(atraxa)
  })
})

describe('mergeEnrichedColors (AUDIT)', () => {
  const mountain = { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 60 }
  const forest = { cardName: 'Forest', setCode: 'LEA', cardNumber: '294', amount: 60 }
  const deckOf = (over: Record<string, unknown>) => ({
    id: 'd1',
    name: 'D',
    format: 'Freeform',
    colors: [],
    cards: [mountain],
    sideboard: [],
    createdAt: 0,
    updatedAt: 0,
    source: 'custom',
    ...over,
  }) as unknown as DeckV2

  it('aplica colores cuando el mazo no cambió', () => {
    const cur = [deckOf({})]
    const enriched = [deckOf({ colors: ['R'] })]
    const merged = mergeEnrichedColors(cur, enriched)
    expect(merged[0].colors).toEqual(['R'])
  })

  it('no pisa ediciones del usuario hechas durante los fetches', () => {
    const cur = [deckOf({ cards: [mountain, forest] })]
    const enriched = [deckOf({ colors: ['R'] })]
    expect(mergeEnrichedColors(cur, enriched)).toBe(cur)
  })

  it('no toca mazos que ya tienen colores', () => {
    const cur = [deckOf({ colors: ['G'] })]
    const enriched = [deckOf({ colors: ['R'] })]
    expect(mergeEnrichedColors(cur, enriched)).toBe(cur)
  })
})

describe('pruneSelectedId (C.13-mayores §2)', () => {
  const decks = [{ id: 'a' }, { id: 'b' }] as DeckV2[]

  it('conserva el seleccionado si sigue existiendo', () => {
    expect(pruneSelectedId(decks, 'a')).toBe('a')
  })

  it('limpia el seleccionado si ya no existe tras load()', () => {
    expect(pruneSelectedId(decks, 'fantasma')).toBeNull()
  })

  it('null se queda en null', () => {
    expect(pruneSelectedId(decks, null)).toBeNull()
  })
})

describe('DecksGallery footer (C.13-mayores §1–§2)', () => {
  it('deshabilita el backup sin customs y lo habilita con customs', async () => {
    const { unmount } = render(<DecksGallery onEdit={() => {}} />)
    const backupEmpty = await screen.findByText('Exportar Mazo (0)')
    expect((backupEmpty.closest('button') as HTMLButtonElement).disabled).toBe(true)
    unmount()

    storeState.decks = [customDeck()]
    render(<DecksGallery onEdit={() => {}} />)
    const backupOne = await screen.findByText('Exportar Mazo (1)')
    expect((backupOne.closest('button') as HTMLButtonElement).disabled).toBe(false)
  })

  it('etiqueta restore como importar y favorito con ★ visible', async () => {
    storeState.decks = [customDeck({ favorite: true })]
    render(<DecksGallery onEdit={() => {}} />)
    expect(await screen.findByText('Importar Mazo (JSON)')).not.toBeNull()
    const stars = await screen.findAllByText('★')
    const favBtn = stars.map((s) => s.closest('button')).find(Boolean)
    expect(favBtn?.getAttribute('aria-pressed')).toBe('true')
  })

  it('el confirm de borrado muestra el NOMBRE del mazo', async () => {
    storeState.decks = [customDeck()]
    render(<DecksGallery onEdit={() => {}} />)
    const delBtn = await screen.findByText('Eliminar')
    fireEvent.click(delBtn.closest('button')!)
    await waitFor(() => expect(confirmState.calls.length).toBe(1))
    expect(confirmState.calls[0]).toContain('Mi Burn')
    await waitFor(() => expect(storeState.decks.length).toBe(0))
  })

  it('el borrado de precon queda deshabilitado con marca visible', async () => {
    render(<DecksGallery onEdit={() => {}} />)
    fireEvent.click(await screen.findByText('Mage Web bolt'))
    const delBtn = await screen.findByText('Eliminar')
    expect((delBtn.closest('button') as HTMLButtonElement).disabled).toBe(true)
    expect(delBtn.closest('button')?.getAttribute('title')).toContain('Precon')
  })
})
