import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Tabs, { tabPanelProps, type TabItem } from './Tabs'

afterEach(cleanup)

const items: TabItem[] = [
  { id: 'a', label: 'Alpha', testId: 'tab-a' },
  { id: 'b', label: 'Beta', badge: <span data-testid="badge">3</span> },
  { id: 'c', label: 'Gamma', hidden: true },
  { id: 'd', label: 'Delta' },
]

function Harness({ onChange }: { onChange?: (id: string) => void }) {
  const [value, setValue] = useState('a')
  return (
    <>
      <Tabs
        items={items}
        value={value}
        idPrefix="t"
        label="demo"
        onChange={(id) => {
          setValue(id)
          onChange?.(id)
        }}
      />
      <div {...tabPanelProps('t', value)}>{value}</div>
    </>
  )
}

describe('Tabs', () => {
  it('exposes tablist/tab semantics with a roving tabindex and skips hidden items', () => {
    render(<Harness />)
    expect(screen.getByRole('tablist', { name: 'demo' })).toBeTruthy()
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((t) => t.textContent)).toEqual(['Alpha', 'Beta3', 'Delta'])
    expect(tabs[0].getAttribute('aria-selected')).toBe('true')
    expect(tabs[0].tabIndex).toBe(0)
    expect(tabs[1].tabIndex).toBe(-1)
    expect(tabs[0].getAttribute('aria-controls')).toBe('t-panel-a')
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe('t-tab-a')
  })

  it('selects on click and forwards testId', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    fireEvent.click(screen.getByText('Beta'))
    expect(onChange).toHaveBeenCalledWith('b')
    expect(screen.getByTestId('tab-a')).toBeTruthy()
  })

  it('moves with arrow keys, wraps and supports Home/End', () => {
    render(<Harness />)
    const list = screen.getByRole('tablist')
    fireEvent.keyDown(list, { key: 'ArrowRight' })
    expect(screen.getByRole('tabpanel').textContent).toBe('b')
    fireEvent.keyDown(list, { key: 'ArrowRight' })
    expect(screen.getByRole('tabpanel').textContent).toBe('d')
    fireEvent.keyDown(list, { key: 'ArrowRight' })
    expect(screen.getByRole('tabpanel').textContent).toBe('a')
    fireEvent.keyDown(list, { key: 'End' })
    expect(screen.getByRole('tabpanel').textContent).toBe('d')
    fireEvent.keyDown(list, { key: 'Home' })
    expect(screen.getByRole('tabpanel').textContent).toBe('a')
    fireEvent.keyDown(list, { key: 'ArrowLeft' })
    expect(screen.getByRole('tabpanel').textContent).toBe('d')
  })
})
