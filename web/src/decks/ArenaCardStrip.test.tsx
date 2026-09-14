import { describe, expect, it, afterEach, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { ArenaCardStrip } from './ArenaCardStrip'
import type { DeckCard } from '../lobby/decks'

const confirmMock = vi.fn(async (_msg: string) => true)
vi.mock('../ui/confirmDialog', () => ({
  confirmDialog: (msg: string) => confirmMock(msg),
}))

const bolt: DeckCard = { cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 2 }
const mountain: DeckCard = { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 1 }

const key = (c: DeckCard) => `${c.setCode}:${c.cardNumber}:${c.cardName}`

describe('ArenaCardStrip UX (auditoría)', () => {
  afterEach(() => {
    cleanup()
    confirmMock.mockClear()
  })

  it('las teclas sobre los botones de acción no burbujean a la tira (Enter en + no resta)', () => {
    const onDec = vi.fn()
    const onInc = vi.fn()
    const { container } = render(<ArenaCardStrip card={bolt} onDec={onDec} onInc={onInc} />)
    const plus = container.querySelector('.strip-btn[title="Añadir 1"]')!
    fireEvent.keyDown(plus, { key: 'Enter' })
    expect(onDec).not.toHaveBeenCalled()
  })

  it('quitar todas las copias pide confirmación cuando hay más de una', async () => {
    const onRemove = vi.fn()
    const { container } = render(<ArenaCardStrip card={bolt} onRemove={onRemove} />)
    fireEvent.click(container.querySelector('.strip-btn.danger')!)
    await waitFor(() => expect(onRemove).toHaveBeenCalledWith(key(bolt)))
    expect(confirmMock).toHaveBeenCalledOnce()
    expect(String(confirmMock.mock.calls[0][0])).toContain('Lightning Bolt')
  })

  it('si se cancela la confirmación no quita la carta', async () => {
    confirmMock.mockResolvedValueOnce(false)
    const onRemove = vi.fn()
    const { container } = render(<ArenaCardStrip card={bolt} onRemove={onRemove} />)
    fireEvent.click(container.querySelector('.strip-btn.danger')!)
    await waitFor(() => expect(confirmMock).toHaveBeenCalledOnce())
    expect(onRemove).not.toHaveBeenCalled()
  })

  it('con una copia no pregunta y el foco pasa a la tira siguiente al desaparecer', async () => {
    function Harness() {
      const [cards, setCards] = useState<DeckCard[]>([mountain, bolt])
      return (
        <>
          {cards.map((c) => (
            <ArenaCardStrip
              key={c.cardName}
              card={c}
              onRemove={(k) => setCards((prev) => prev.filter((x) => key(x) !== k))}
            />
          ))}
        </>
      )
    }
    const { container } = render(<Harness />)
    const first = container.querySelectorAll('.arena-card-strip')[0] as HTMLElement
    fireEvent.click(first.querySelector('.strip-btn.danger')!)
    expect(confirmMock).not.toHaveBeenCalled()
    await waitFor(() => expect(container.querySelectorAll('.arena-card-strip').length).toBe(1))
    await waitFor(() => {
      expect(document.activeElement).toBe(container.querySelector('.arena-card-strip'))
    })
  })
})
