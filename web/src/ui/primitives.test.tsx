import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Button from './Button'
import Checkbox from './Checkbox'
import IconButton from './IconButton'
import MenuItem from './MenuItem'
import DropdownMenu from './DropdownMenu'
import ChipButton from './ChipButton'
import Chip from './Chip'
import EmptyState from './EmptyState'
import Toggle, { Switch } from './Toggle'
import { useEscape } from './useEscape'

afterEach(cleanup)

describe('EmptyState', () => {
  it('renders icon, title, description and action', () => {
    render(<EmptyState icon="search" title="Nothing" action={<button>Go</button>}>Try again</EmptyState>)
    expect(screen.getByText('Nothing')).toBeTruthy()
    expect(screen.getByText('Try again')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Go' })).toBeTruthy()
    expect(document.querySelector('.ui-empty-icon svg')).toBeTruthy()
  })

  it('applies size, boxed and fill modifiers and forwards attributes', () => {
    render(<EmptyState size="lg" boxed fill data-testid="e">x</EmptyState>)
    const el = screen.getByTestId('e')
    expect(el.className).toContain('ui-empty--lg')
    expect(el.className).toContain('ui-empty--boxed')
    expect(el.className).toContain('ui-empty--fill')
  })
})

describe('Checkbox', () => {
  it('reports the new checked value and links the label to the input', () => {
    const onChange = vi.fn()
    render(<Checkbox checked={false} onChange={onChange} label="Remember" description="hint" inputTestId="cb" />)
    fireEvent.click(screen.getByLabelText(/Remember/))
    expect(onChange).toHaveBeenCalledWith(true)
    expect(screen.getByTestId('cb')).toBeTruthy()
    expect(screen.getByText('hint')).toBeTruthy()
  })

  it('respects disabled and the card variant', () => {
    const onChange = vi.fn()
    render(<Checkbox card disabled checked onChange={onChange} label="Locked" />)
    expect((screen.getByLabelText(/Locked/) as HTMLInputElement).disabled).toBe(true)
    expect(document.querySelector('.ui-check--card')).toBeTruthy()
  })
})

describe('ChipButton', () => {
  it('exposes aria-pressed only when a selected state is provided', () => {
    const { rerender } = render(<ChipButton>plain</ChipButton>)
    expect(screen.getByRole('button').hasAttribute('aria-pressed')).toBe(false)
    rerender(<ChipButton active>on</ChipButton>)
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button').className).toContain('ui-chip--brand')
  })

  it('uses the requested tone when active and neutral otherwise', () => {
    const { rerender } = render(<ChipButton active activeTone="gold">x</ChipButton>)
    expect(screen.getByRole('button').className).toContain('ui-chip--gold')
    rerender(<ChipButton active={false} activeTone="gold">x</ChipButton>)
    expect(screen.getByRole('button').className).toContain('ui-chip--neutral')
  })
})

describe('Chip', () => {
  it('maps size and pill to modifier classes', () => {
    render(<Chip size="xs" pill tone="ok">ok</Chip>)
    const el = screen.getByText('ok')
    expect(el.className).toContain('ui-chip--xs')
    expect(el.className).toContain('ui-chip--pill')
    expect(el.className).toContain('ui-chip--ok')
  })
})

describe('Switch and Toggle', () => {
  it('toggles through the switch role', () => {
    const onChange = vi.fn()
    render(<Switch checked={false} onChange={onChange} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('Toggle wraps a labelled switch and blocks changes when disabled', () => {
    const onChange = vi.fn()
    render(<Toggle checked label="Sound" disabled onChange={onChange} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText('Sound')).toBeTruthy()
  })
})

describe('useEscape', () => {
  it('calls the handler on Escape only while enabled', () => {
    const handler = vi.fn()
    const { rerender } = renderHook(({ on }) => useEscape(handler, on), { initialProps: { on: true } })
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(handler).not.toHaveBeenCalled()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(handler).toHaveBeenCalledTimes(1)
    rerender({ on: false })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(handler).toHaveBeenCalledTimes(1)
  })
})

describe('IconButton', () => {
  it('always exposes its label as accessible name and title', () => {
    const onClick = vi.fn()
    render(<IconButton label="Zoom in" icon="plus" size="lg" round onClick={onClick} />)
    const btn = screen.getByRole('button', { name: 'Zoom in' })
    expect(btn.getAttribute('title')).toBe('Zoom in')
    expect(btn.className).toContain('ui-icon-btn--lg')
    expect(btn.className).toContain('ui-icon-btn--round')
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalled()
  })
})

describe('MenuItem', () => {
  it('maps danger and selected to modifier classes', () => {
    render(<><MenuItem danger>Leave</MenuItem><MenuItem selected>Current</MenuItem></>)
    expect(screen.getByText('Leave').className).toContain('ui-menu-item--danger')
    expect(screen.getByText('Current').className).toContain('ui-menu-item--selected')
  })
})

describe('Button variants', () => {
  it.each(['soft', 'soft-danger', 'link'] as const)('renders the %s variant', (variant) => {
    render(<Button variant={variant}>x</Button>)
    expect(screen.getByRole('button').className).toContain(`ui-btn--${variant}`)
  })
})

describe('DropdownMenu', () => {
  it('abre al pulsar el disparador, ejecuta el ítem y se cierra', () => {
    const onPick = vi.fn()
    render(
      <DropdownMenu label="Exportar">
        <MenuItem role="menuitem" onClick={onPick}>Arena</MenuItem>
      </DropdownMenu>,
    )
    const trigger = screen.getByRole('button', { name: /Exportar/ })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Arena' }))
    expect(onPick).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('se cierra con Escape y al pulsar fuera', () => {
    render(
      <div>
        <span data-testid="outside">fuera</span>
        <DropdownMenu label="Más">
          <MenuItem role="menuitem">Uno</MenuItem>
        </DropdownMenu>
      </div>,
    )
    const trigger = screen.getByRole('button', { name: /Más/ })
    fireEvent.click(trigger)
    expect(screen.getByRole('menu')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(trigger)
    fireEvent.pointerDown(screen.getByTestId('outside'))
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('deshabilitado no abre y aplica dirección y alineación', () => {
    const { rerender } = render(<DropdownMenu label="X" disabled><MenuItem role="menuitem">a</MenuItem></DropdownMenu>)
    fireEvent.click(screen.getByRole('button', { name: /X/ }))
    expect(screen.queryByRole('menu')).toBeNull()
    rerender(<DropdownMenu label="X" direction="up" align="end"><MenuItem role="menuitem">a</MenuItem></DropdownMenu>)
    fireEvent.click(screen.getByRole('button', { name: /X/ }))
    expect(screen.getByRole('menu').className).toContain('ui-dropdown-menu--up')
    expect(screen.getByRole('menu').className).toContain('ui-dropdown-menu--end')
  })
})
