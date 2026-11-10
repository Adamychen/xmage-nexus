import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Select, { SELECT_SEARCH_THRESHOLD, type SelectOption } from './Select'
import Field from './Field'
import Modal from './Modal'

afterEach(cleanup)

const FRUITS: SelectOption<string>[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'blueberry', label: 'Blueberry', disabled: true },
  { value: 'cherry', label: 'Cherry' },
  { value: 'date', label: 'Date' },
]

function Harness({ options = FRUITS, initial = 'banana', onChange, searchable }: {
  options?: SelectOption<string>[]
  initial?: string
  onChange?: (v: string) => void
  searchable?: boolean
}) {
  const [value, setValue] = useState(initial)
  return (
    <Field label="Fruit">
      <Select
        value={value}
        options={options}
        searchable={searchable}
        onChange={(v) => { setValue(v); onChange?.(v) }}
        data-testid="fruit"
      />
    </Field>
  )
}

const trigger = () => screen.getByRole('combobox', { name: 'Fruit' })
const listbox = () => screen.queryByRole('listbox')
const activeOption = () => {
  const id = trigger().getAttribute('aria-activedescendant')
  return id ? document.getElementById(id)?.textContent : null
}

describe('Select', () => {
  it('CTL-1: shows the chosen value and opens a list with the choice highlighted, outside the page flow', () => {
    render(<Harness />)
    expect(trigger().textContent).toBe('Banana')
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(trigger())
    expect(trigger().getAttribute('aria-expanded')).toBe('true')
    const list = listbox()!
    expect(list.getAttribute('aria-label')).toBe('Fruit')
    expect(list.parentElement?.parentElement).toBe(document.body)
    const selected = screen.getByRole('option', { selected: true })
    expect(selected.textContent).toBe('Banana')
    expect(selected.classList.contains('is-selected')).toBe(true)
    expect(screen.getAllByRole('option').filter((o) => o.classList.contains('is-selected'))).toHaveLength(1)
    expect(document.querySelector('select')).toBeNull()
  })

  it('CTL-1: a click on an option chooses it, closes the list and returns the focus', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    fireEvent.click(trigger())
    fireEvent.click(screen.getByRole('option', { name: 'Cherry' }))
    expect(onChange).toHaveBeenCalledWith('cherry')
    expect(listbox()).toBeNull()
    expect(trigger().textContent).toBe('Cherry')
    expect(document.activeElement).toBe(trigger())
  })

  it('CTL-1: a disabled option cannot be chosen', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    fireEvent.click(trigger())
    const blueberry = screen.getByRole('option', { name: 'Blueberry' })
    expect(blueberry.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(blueberry)
    expect(onChange).not.toHaveBeenCalled()
    expect(listbox()).not.toBeNull()
  })

  it('CTL-1: a click outside closes the list without a change and without closing the dialog', () => {
    const onChange = vi.fn()
    const onEscape = vi.fn()
    const onBackdropClick = vi.fn()
    render(
      <Modal backdropClassName="bd" dialogClassName="dlg" onEscape={onEscape} onBackdropClick={onBackdropClick}>
        <p data-testid="outside">text</p>
        <Harness onChange={onChange} />
      </Modal>,
    )
    fireEvent.click(trigger())
    fireEvent.pointerDown(screen.getByTestId('outside'))
    expect(listbox()).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(trigger())
    fireEvent.click(screen.getByRole('option', { name: 'Date' }))
    expect(onChange).toHaveBeenCalledWith('date')
    expect(onBackdropClick).not.toHaveBeenCalled()
    expect(onEscape).not.toHaveBeenCalled()
  })

  it('CTL-1: the list keeps the surface of the screen it opens from', () => {
    render(
      <div className="board-surface">
        <div className="chrome-surface">
          <Harness />
        </div>
      </div>,
    )
    fireEvent.click(trigger())
    expect(document.querySelector('.ui-select-panel')?.classList.contains('chrome-surface')).toBe(true)
  })

  it('CTL-1: a disabled control does not open', () => {
    render(
      <Field label="Fruit">
        <Select value="apple" options={FRUITS} onChange={() => {}} disabled />
      </Field>,
    )
    fireEvent.click(trigger())
    expect(listbox()).toBeNull()
  })
})

describe('Select keyboard', () => {
  it('CTL-2: ArrowDown opens on the chosen option; arrows skip disabled options; Enter chooses', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' })
    expect(listbox()).not.toBeNull()
    expect(activeOption()).toBe('Banana')
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' })
    expect(activeOption()).toBe('Cherry')
    fireEvent.keyDown(trigger(), { key: 'ArrowUp' })
    expect(activeOption()).toBe('Banana')
    fireEvent.keyDown(trigger(), { key: 'End' })
    expect(activeOption()).toBe('Date')
    fireEvent.keyDown(trigger(), { key: 'Home' })
    expect(activeOption()).toBe('Apple')
    fireEvent.keyDown(trigger(), { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('apple')
    expect(listbox()).toBeNull()
    expect(document.activeElement).toBe(trigger())
  })

  it('CTL-2: Space opens and chooses too', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    fireEvent.keyDown(trigger(), { key: ' ' })
    expect(listbox()).not.toBeNull()
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' })
    fireEvent.keyDown(trigger(), { key: ' ' })
    expect(onChange).toHaveBeenCalledWith('cherry')
  })

  it('CTL-2: typing on the closed control picks the next option with that letter, without opening', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    fireEvent.keyDown(trigger(), { key: 'd' })
    expect(onChange).toHaveBeenLastCalledWith('date')
    expect(listbox()).toBeNull()
  })

  it('CTL-2: typing in the open list moves the highlight to the typed prefix', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    fireEvent.click(trigger())
    fireEvent.keyDown(trigger(), { key: 'c' })
    expect(activeOption()).toBe('Cherry')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('CTL-2: Escape closes the list without a change and leaves the dialog open', () => {
    const onChange = vi.fn()
    const onEscape = vi.fn()
    render(
      <Modal backdropClassName="bd" dialogClassName="dlg" onEscape={onEscape}>
        <Harness onChange={onChange} />
      </Modal>,
    )
    fireEvent.click(trigger())
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(listbox()).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
    expect(onEscape).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(trigger())
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  it('CTL-2: Tab closes the list without a change', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    fireEvent.click(trigger())
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' })
    fireEvent.keyDown(trigger(), { key: 'Tab' })
    expect(listbox()).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('Select search', () => {
  const COUNTRIES: SelectOption<string>[] = [
    'Alemania', 'Argentina', 'Brasil', 'Canadá', 'Chile', 'España', 'Francia', 'Italia', 'Japón', 'México', 'Perú',
    'Portugal', 'Uruguay',
  ].map((name) => ({ value: name.slice(0, 2).toLowerCase() + name.length, label: `🏳 ${name}`, text: name }))

  it('CTL-3: a list longer than the threshold opens with a focused search box; a short one has none', () => {
    expect(COUNTRIES.length).toBeGreaterThan(SELECT_SEARCH_THRESHOLD)
    const { unmount } = render(<Harness options={COUNTRIES} initial={COUNTRIES[0].value} />)
    fireEvent.click(trigger())
    const search = screen.getByRole('combobox', { name: 'Buscar...' })
    expect(document.activeElement).toBe(search)
    unmount()
    render(<Harness />)
    fireEvent.click(trigger())
    expect(screen.queryByRole('combobox', { name: 'Buscar...' })).toBeNull()
  })

  it('CTL-3: the search ignores case and accents, and Enter chooses the first match', () => {
    const onChange = vi.fn()
    render(<Harness options={COUNTRIES} initial={COUNTRIES[0].value} onChange={onChange} />)
    fireEvent.click(trigger())
    const search = screen.getByRole('combobox', { name: 'Buscar...' })
    fireEvent.change(search, { target: { value: 'JAPON' } })
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['🏳 Japón'])
    expect(search.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option').id)
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(COUNTRIES.find((c) => c.text === 'Japón')!.value)
    expect(document.activeElement).toBe(trigger())
  })

  it('CTL-3: arrows work from the box, and a search with no match says so', () => {
    render(<Harness options={COUNTRIES} initial={COUNTRIES[0].value} />)
    fireEvent.click(trigger())
    const search = screen.getByRole('combobox', { name: 'Buscar...' })
    fireEvent.change(search, { target: { value: 'gua' } })
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['🏳 Uruguay'])
    fireEvent.change(search, { target: { value: 'a' } })
    const first = search.getAttribute('aria-activedescendant')
    fireEvent.keyDown(search, { key: 'ArrowDown' })
    expect(search.getAttribute('aria-activedescendant')).not.toBe(first)
    fireEvent.change(search, { target: { value: 'zzz' } })
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.getByRole('status').textContent).toBe('Sin resultados para «zzz»')
  })

  it('CTL-3: a screen can ask for the search box on a short list', () => {
    render(<Harness searchable />)
    fireEvent.click(trigger())
    expect(screen.getByRole('combobox', { name: 'Buscar...' })).toBeTruthy()
  })
})
