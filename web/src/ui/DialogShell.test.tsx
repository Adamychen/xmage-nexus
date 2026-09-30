import { render, fireEvent, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'
import DialogShell from './DialogShell'

function renderShell(props: { onClose?: () => void; onEscape?: () => void; topRight?: boolean }) {
  const { onClose, onEscape, topRight } = props
  return render(
    <DialogShell
      labelledBy="t"
      titleId="t"
      kickerIcon="settings"
      kickerLabel="Kicker"
      title="Title"
      onClose={onClose}
      onEscape={onEscape}
      topRight={topRight ? <button type="button">Cerrar</button> : undefined}
    >
      <span>body</span>
    </DialogShell>,
  )
}

describe('DialogShell escape', () => {
  afterEach(() => {
    cleanup()
  })

  it('closes with Escape through onClose', () => {
    const onClose = vi.fn()
    renderShell({ onClose })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes with Escape through onEscape when the caller draws its own ✕ (no onClose)', () => {
    const onEscape = vi.fn()
    renderShell({ onEscape, topRight: true })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  it('does not steal Escape when it has no close path', () => {
    renderShell({})
    const ev = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
    window.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(false)
  })
})
