import { render, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CardGrid from './CardGrid'
import type { FeedbackPrompt } from './feedback'

function makePrompt(overrides: Partial<FeedbackPrompt> = {}): FeedbackPrompt {
  return {
    method: 'GAME_TARGET',
    gameId: 'g-1',
    title: 'Search your library',
    message: 'Choose a creature card',
    mode: 'uuid',
    options: [],
    min: 0,
    max: 1,
    required: true,
    cards: [
      { id: 'c-1', name: 'Grizzly Bears', expansionSetCode: 'IMA', cardNumber: '165' },
      { id: 'c-2', name: 'Lightning Bolt', expansionSetCode: 'M10', cardNumber: '147' },
      { id: 'c-3', name: 'Island', expansionSetCode: 'M21', cardNumber: '237' },
    ],
    ...overrides,
  }
}

describe('CardGrid', () => {
  it('renders all cards in the grid', () => {
    const { container } = render(<CardGrid prompt={makePrompt()} selected={[]} setSelected={vi.fn()} send={vi.fn()} busy={false} />)
    expect(container.textContent).toContain('Grizzly Bears')
    expect(container.textContent).toContain('Lightning Bolt')
    expect(container.textContent).toContain('Island')
  })

  it('shows the prompt message', () => {
    const { container } = render(<CardGrid prompt={makePrompt()} selected={[]} setSelected={vi.fn()} send={vi.fn()} busy={false} />)
    expect(container.textContent).toContain('Choose a creature card')
  })

  it('shows the search filter input and card count badge', () => {
    const { container } = render(<CardGrid prompt={makePrompt()} selected={[]} setSelected={vi.fn()} send={vi.fn()} busy={false} />)
    expect(container.querySelector('input[placeholder]')).toBeTruthy()
    expect(container.querySelector('.ui-chip')?.textContent).toContain('3 cartas')
  })

  it('labels the search filter for assistive tech', () => {
    const { container } = render(<CardGrid prompt={makePrompt()} selected={[]} setSelected={vi.fn()} send={vi.fn()} busy={false} />)
    const input = container.querySelector('.card-grid-filter') as HTMLInputElement
    expect(input.getAttribute('aria-label')).toBeTruthy()
  })

  it('filters cards by name', () => {
    const cards = Array.from({ length: 10 }, (_, i) => ({
      id: `c-${i}`, name: i === 3 ? 'Volcanic Hammer' : `Card ${i}`, expansionSetCode: 'TEST', cardNumber: String(i),
    }))
    const { container } = render(<CardGrid prompt={makePrompt({ cards })} selected={[]} setSelected={vi.fn()} send={vi.fn()} busy={false} />)
    const input = container.querySelector('input[placeholder]') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Volcanic' } })
    expect(container.textContent).toContain('Volcanic Hammer')
    expect(container.textContent).not.toContain('Card 0')
  })

  it('PRM-7: hides the cancel button when the prompt is required (sending false makes the server re-ask)', () => {
    const { container } = render(<CardGrid prompt={makePrompt()} selected={[]} setSelected={vi.fn()} send={vi.fn()} busy={false} />)
    expect(container.querySelector('.card-grid-actions button')).toBeNull()
  })

  it('shows confirm button for a client-side multi-select', () => {
    const { container } = render(<CardGrid prompt={makePrompt({ method: 'GAME_SELECT_CARDS', max: 3 })} selected={['c-1', 'c-2']} setSelected={vi.fn()} send={vi.fn()} busy={false} />)
    expect(container.textContent).toContain('Confirmar')
  })

  it('PRM-6: a target pick with no stated maximum sends on click, with no confirm button', () => {
    const { container } = render(<CardGrid prompt={makePrompt({ max: 3 })} selected={['c-1', 'c-2']} setSelected={vi.fn()} send={vi.fn()} busy={false} />)
    expect(container.textContent).not.toContain('Confirmar')
  })

  it('does not show confirm button for single-select', () => {
    const { container } = render(<CardGrid prompt={makePrompt({ max: 1 })} selected={[]} setSelected={vi.fn()} send={vi.fn()} busy={false} />)
    expect(container.textContent).not.toContain('Confirmar')
  })

  it('disables the finish button when busy on an optional prompt', () => {
    const { container } = render(<CardGrid prompt={makePrompt({ required: false })} selected={[]} setSelected={vi.fn()} send={vi.fn()} busy={true} />)
    const finishBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Terminar selección')) as HTMLButtonElement
    expect(finishBtn.disabled).toBe(true)
  })

  it('shows empty state when filter matches nothing', () => {
    const cards = Array.from({ length: 10 }, (_, i) => ({
      id: `c-${i}`, name: `Card ${i}`, expansionSetCode: 'TEST', cardNumber: String(i),
    }))
    const { container } = render(<CardGrid prompt={makePrompt({ cards })} selected={[]} setSelected={vi.fn()} send={vi.fn()} busy={false} />)
    const input = container.querySelector('input[placeholder]') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'zzzznothing' } })
    expect(container.textContent).toContain('No se encontraron cartas')
  })

  it('PRM-7: shows the optional finish button (and no cancel) when required is false', () => {
    const send = vi.fn()
    const { container } = render(<CardGrid prompt={makePrompt({ required: false, max: 3 })} selected={[]} setSelected={vi.fn()} send={send} busy={false} />)
    expect(container.textContent).toContain('Terminar selección')
    expect(container.textContent).not.toContain('Cancelar')
    fireEvent.click(Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Terminar selección'))!)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('PRM-6: a target pick of several cards collects the picks and sends nothing until Confirm', async () => {
    const send = vi.fn()
    const commands = await import('../net/commands')
    const uuid = vi.spyOn(commands, 'sendPlayerUUID').mockResolvedValue({ ok: true } as never)
    const prompt = makePrompt({
      message: 'Select basic land cards (selected 0 of 2)',
      progress: { selected: 0, max: 2 },
      options: [{ id: 'c-1', label: 'Grizzly Bears', value: 'c-1' }, { id: 'c-2', label: 'Lightning Bolt', value: 'c-2' }, { id: 'c-3', label: 'Island', value: 'c-3' }],
      required: false,
    })
    let selected: string[] = []
    const setSelected = vi.fn((next: React.SetStateAction<string[]>) => {
      selected = typeof next === 'function' ? next(selected) : next
    })
    const view = render(<CardGrid prompt={prompt} selected={selected} setSelected={setSelected} send={send} busy={false} />)
    fireEvent.click(view.container.querySelectorAll<HTMLButtonElement>('.card-grid-cell')[2])
    view.rerender(<CardGrid prompt={prompt} selected={selected} setSelected={setSelected} send={send} busy={false} />)
    fireEvent.click(view.container.querySelectorAll<HTMLButtonElement>('.card-grid-cell')[0])
    view.rerender(<CardGrid prompt={prompt} selected={selected} setSelected={setSelected} send={send} busy={false} />)
    expect(selected).toEqual(['c-3', 'c-1'])
    fireEvent.click(view.container.querySelectorAll<HTMLButtonElement>('.card-grid-cell')[1])
    expect(selected, 'a third card does not fit a pick of two').toEqual(['c-3', 'c-1'])
    expect(send).not.toHaveBeenCalled()
    expect(uuid).not.toHaveBeenCalled()
    expect(view.getByTestId('card-grid-progress').textContent).toBe('Seleccionadas 2 de 2')
    expect(view.container.textContent).not.toContain('Terminar selección')

    fireEvent.click(view.container.querySelector('.card-grid-actions .arena-card-grid-done')!)
    expect(uuid).toHaveBeenCalledTimes(1)
    expect(uuid).toHaveBeenCalledWith('c-3', 'g-1')
    uuid.mockRestore()
  })

  it('PRM-5: pre-filters the grid to the server-selectable cards (the request filter)', () => {
    const prompt = makePrompt({
      message: 'Search your library for an artifact card',
      options: [{ id: 'c-3', label: 'Island', value: 'c-3' }],
    })
    const { container } = render(<CardGrid prompt={prompt} selected={[]} setSelected={vi.fn()} send={vi.fn()} busy={false} />)
    const cells = container.querySelectorAll('.card-grid-cell')
    expect(cells.length).toBe(1)
    expect(container.textContent).toContain('Island')
    expect(container.textContent).not.toContain('Grizzly Bears')
    expect(container.textContent).not.toContain('Lightning Bolt')
    expect(container.querySelector('.ui-chip')?.textContent).toContain('1 / 3')
  })

  it('PRM-5: toggles between only valid cards and the full candidate list', () => {
    const prompt = makePrompt({
      options: [{ id: 'c-3', label: 'Island', value: 'c-3' }],
    })
    const { container } = render(<CardGrid prompt={prompt} selected={[]} setSelected={vi.fn()} send={vi.fn()} busy={false} />)
    const toggle = () => Array.from(container.querySelectorAll('button')).find((b) => b.classList.contains('card-grid-scope-toggle')) as HTMLButtonElement

    expect(toggle().textContent).toContain('Mostrar todas (3)')
    fireEvent.click(toggle())
    expect(container.querySelectorAll('.card-grid-cell').length).toBe(3)
    expect(toggle().textContent).toContain('Solo válidas (1)')
    fireEvent.click(toggle())
    expect(container.querySelectorAll('.card-grid-cell').length).toBe(1)
  })

  it('PRM-5: keeps chosen cards visible even when they are no longer selectable', () => {
    const prompt = makePrompt({
      chosenTargets: ['c-1'],
      options: [{ id: 'c-3', label: 'Island', value: 'c-3' }],
    })
    const { container } = render(<CardGrid prompt={prompt} selected={[]} setSelected={vi.fn()} send={vi.fn()} busy={false} />)
    expect(container.textContent).toContain('Grizzly Bears')
    expect(container.textContent).toContain('Island')
    expect(container.textContent).not.toContain('Lightning Bolt')
  })

  it('PRM-5: disables the non-selectable cells when the full list is shown', () => {
    const prompt = makePrompt({ options: [{ id: 'c-3', label: 'Island', value: 'c-3' }] })
    const { container } = render(<CardGrid prompt={prompt} selected={[]} setSelected={vi.fn()} send={vi.fn()} busy={false} />)
    fireEvent.click(container.querySelector('.card-grid-scope-toggle')!)
    const cells = container.querySelectorAll<HTMLButtonElement>('.card-grid-cell')
    expect(cells[0].disabled).toBe(true)
    expect(cells[1].disabled).toBe(true)
    expect(cells[2].disabled).toBe(false)
  })

  it('keeps the multi-select Confirm disabled while nothing is selected (min 0)', () => {
    const send = vi.fn()
    const { container } = render(<CardGrid prompt={makePrompt({ method: 'GAME_SELECT_CARDS', min: 0, max: 2 })} selected={[]} setSelected={vi.fn()} send={send} busy={false} />)
    const confirm = container.querySelector<HTMLButtonElement>('.card-grid-actions button')!
    expect(confirm.disabled).toBe(true)
    fireEvent.click(confirm)
    expect(send).not.toHaveBeenCalled()
  })

  it('DLG-6: advertises the Alt peek and lets the player peek repeatedly until a card is chosen', () => {
    const send = vi.fn()
    const prompt = makePrompt({ options: [{ id: 'c-1', label: 'Grizzly Bears', value: 'c-1' }] as never })
    const { container } = render(<CardGrid prompt={prompt} selected={[]} setSelected={vi.fn()} send={send} busy={false} />)
    const hint = container.querySelector('[data-testid="card-grid-peek-hint"]') as HTMLElement
    expect(hint.querySelector('.card-grid-peek-hint-idle')?.textContent).toBeTruthy()
    expect(hint.querySelector('.card-grid-peek-hint-active')?.textContent).toBeTruthy()
    const backdrop = container.querySelector('.feedback-backdrop') as HTMLElement
    expect(backdrop.contains(hint)).toBe(true)
    const input = container.querySelector('.card-grid-filter') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Grizzly' } })
    for (let i = 0; i < 3; i++) {
      fireEvent.keyDown(window, { key: 'Alt' })
      expect(backdrop.getAttribute('data-peek')).toBe('1')
      fireEvent.keyUp(window, { key: 'Alt' })
      expect(backdrop.getAttribute('data-peek')).toBeNull()
    }
    expect(input.value).toBe('Grizzly')
    const cell = container.querySelector('.card-grid-cell') as HTMLButtonElement
    fireEvent.click(cell)
    expect(send).toHaveBeenCalledTimes(1)
  })
})
