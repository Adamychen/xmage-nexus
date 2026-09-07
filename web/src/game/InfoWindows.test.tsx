// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import InfoWindows from './InfoWindows'
import { setState } from '../state/store'
import { makeCard, makeGameView } from '../__fixtures__/gameViews'

const looked = { name: 'Alice', cards: { 'l-1': makeCard({ name: 'Scry Card', parentId: 'l-1' }) } }
const comp = { name: 'Bob', cards: { 'c-1': makeCard({ name: 'Lurrus of the Dream-Den', parentId: 'c-1' }) } }

describe('InfoWindows', () => {
  beforeEach(() => {
    setState({ game: null })
  })
  afterEach(() => {
    setState({ game: null })
    cleanup()
  })

  it('sin partida (game null) no renderiza nada ni entra en loop', () => {
    setState({ game: null })
    render(<InfoWindows />)
    expect(document.querySelector('.pile-overlay')).toBeNull()
  })

  it('sin lookedAt ni companion no renderiza nada', () => {
    setState({ game: makeGameView({}) as never })
    render(<InfoWindows />)
    expect(document.querySelector('.pile-overlay')).toBeNull()
  })

  it('muestra una ventana por entrada con sus cartas', () => {
    setState({ game: makeGameView({ lookedAt: [looked], companion: [comp] }) as never })
    const { getByText } = render(<InfoWindows />)
    expect(document.querySelectorAll('.pile-overlay')).toHaveLength(2)
    expect(getByText('Scry Card')).not.toBeNull()
    expect(getByText('Lurrus of the Dream-Den')).not.toBeNull()
  })

  it('ignora entradas vacías', () => {
    setState({ game: makeGameView({ lookedAt: [{ name: 'Alice', cards: {} }], companion: [] }) as never })
    render(<InfoWindows />)
    expect(document.querySelector('.pile-overlay')).toBeNull()
  })

  it('cerrar oculta hasta que cambian las cartas', () => {
    setState({ game: makeGameView({ lookedAt: [looked], companion: [] }) as never })
    render(<InfoWindows />)
    expect(document.querySelectorAll('.pile-overlay')).toHaveLength(1)
    fireEvent.click(document.querySelector('.pile-overlay-close')!)
    expect(document.querySelector('.pile-overlay')).toBeNull()
  })
})
