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

describe('Select with several values', () => {
  function Multi({ onToggle }: { onToggle?: (v: string) => void }) {
    const [picked, setPicked] = useState<string[]>(['banana'])
    return (
      <Select
        aria-label="Fruit"
        multiple
        selectedValues={picked}
        summary={picked.length ? picked.join(', ') : 'Any'}
        options={FRUITS}
        onChange={(v) => {
          setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))
          onToggle?.(v)
        }}
      />
    )
  }

  it('CTL-4: a pick toggles the value with a check and the list stays open', () => {
    const onToggle = vi.fn()
    render(<Multi onToggle={onToggle} />)
    fireEvent.click(trigger())
    expect(listbox()?.getAttribute('aria-multiselectable')).toBe('true')
    expect(screen.getByRole('option', { name: /Banana/ }).querySelector('.ui-select-check')?.textContent).toBe('✓')
    fireEvent.click(screen.getByRole('option', { name: /Cherry/ }))
    expect(onToggle).toHaveBeenLastCalledWith('cherry')
    expect(listbox()).not.toBeNull()
    expect(trigger().textContent).toBe('banana, cherry')
    fireEvent.keyDown(trigger(), { key: 'Home' })
    fireEvent.keyDown(trigger(), { key: 'Enter' })
    expect(onToggle).toHaveBeenLastCalledWith('apple')
    fireEvent.click(screen.getByRole('option', { name: /Banana/ }))
    expect(onToggle).toHaveBeenLastCalledWith('banana')
    expect(screen.getByRole('option', { name: /Banana/ }).getAttribute('aria-selected')).toBe('false')
  })

  it('CTL-4: typing on the closed control does not toggle anything', () => {
    const onToggle = vi.fn()
    render(<Multi onToggle={onToggle} />)
    fireEvent.keyDown(trigger(), { key: 'c' })
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('CTL-1: titled groups share one list, and a group can keep the list open after its pick', () => {
    const onChange = vi.fn()
    const ui = <>Interface</>
    const cards = <>Cards</>
    render(
      <Select
        aria-label="Fruit"
        selectedValues={['ui:es', 'card:en']}
        keepOpen={(v) => v.startsWith('card:')}
        onChange={onChange}
        options={[
          { value: 'ui:es', label: 'Español', group: ui },
          { value: 'ui:en', label: 'English', group: ui },
          { value: 'card:es', label: 'Español', group: cards },
          { value: 'card:en', label: 'English', group: cards },
        ]}
      />,
    )
    fireEvent.click(trigger())
    expect([...document.querySelectorAll('.ui-select-group')].map((g) => g.textContent)).toEqual(['Interface', 'Cards'])
    expect(screen.getAllByRole('option').map((o) => o.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false', 'true'])
    fireEvent.click(screen.getAllByRole('option')[2])
    expect(onChange).toHaveBeenLastCalledWith('card:es')
    expect(listbox()).not.toBeNull()
    fireEvent.click(screen.getAllByRole('option')[1])
    expect(onChange).toHaveBeenLastCalledWith('ui:en')
    expect(listbox()).toBeNull()
  })

  it('CTL-3: a screen can run its own search, and Enter on the typed text is its own unless the arrows moved first', () => {
    const onChange = vi.fn()
    const onEnter = vi.fn(() => true)
    function Searched() {
      const [query, setQuery] = useState('')
      const shown = FRUITS.filter((f) => f.value.includes(query))
      return (
        <Select
          aria-label="Fruit"
          value="apple"
          options={shown}
          onChange={onChange}
          search={{ query, onQueryChange: setQuery, label: 'Find fruit', onEnter, empty: query !== '' && shown.length === 0 }}
        />
      )
    }
    render(<Searched />)
    fireEvent.click(trigger())
    const search = screen.getByRole('combobox', { name: 'Find fruit' })
    fireEvent.change(search, { target: { value: 'an' } })
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Banana'])
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(onEnter).toHaveBeenLastCalledWith('an')
    expect(onChange).not.toHaveBeenCalled()
    expect(listbox()).toBeNull()

    fireEvent.click(trigger())
    fireEvent.change(screen.getByRole('combobox', { name: 'Find fruit' }), { target: { value: 'e' } })
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Find fruit' }), { key: 'ArrowDown' })
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Find fruit' }), { key: 'Enter' })
    expect(onChange).toHaveBeenLastCalledWith('cherry')
    expect(onEnter).toHaveBeenCalledTimes(1)
  })

  it('CTL-1: a list that would run past its boundary opens toward the left', () => {
    const rect = (left: number, right: number) => ({ left, right, top: 0, bottom: 0, width: right - left, height: 0, x: left, y: 0, toJSON: () => ({}) }) as DOMRect
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('bar')) return rect(0, 300)
      if (this.classList.contains('ui-select-panel')) return rect(200, 400)
      if (this.classList.contains('ui-select-trigger')) return rect(200, 260)
      return rect(0, 0)
    })
    render(
      <div className="bar">
        <Select aria-label="Fruit" value="apple" options={FRUITS} onChange={() => {}} boundary=".bar" data-testid="fruit" />
      </div>,
    )
    fireEvent.click(trigger())
    const panel = screen.getByTestId('fruit-panel')
    expect(panel.dataset.align).toBe('end')
    expect(panel.style.left).toBe('60px')
    spy.mockRestore()
  })
})
