import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import ArenaPromptShell from './ArenaPromptShell'
import { t } from '../../i18n'

afterEach(cleanup)

function renderShell() {
  return render(
    <ArenaPromptShell
      title="Surveil"
      instruction="Drag cards to put them on the top of your library or into your graveyard."
      aside={<div data-testid="aside-card">Source</div>}
      footer={<button type="button">Done</button>}
      testId="arena-shell"
    >
      <div data-testid="left-zone">Graveyard</div>
      <div data-testid="centre-zone">Library</div>
    </ArenaPromptShell>,
  )
}

describe('ArenaPromptShell', () => {
  it('renders a modal dialog named by its title, with the instruction, the zones, the footer and the aside', () => {
    renderShell()
    const dialog = screen.getByRole('dialog', { name: 'Surveil' })
    expect(dialog.getAttribute('data-testid')).toBe('arena-shell')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(screen.getByText(/Drag cards to put them/)).not.toBeNull()
    const stage = dialog.querySelector('.arena-prompt-stage')!
    expect(stage.contains(screen.getByTestId('left-zone'))).toBe(true)
    expect(stage.contains(screen.getByTestId('centre-zone'))).toBe(true)
    expect(stage.querySelector('.arena-prompt-footer')!.textContent).toBe('Done')
    expect(stage.querySelector('aside.arena-prompt-aside [data-testid="aside-card"]')).not.toBeNull()
  })

  it('starts focus on the footer, not on the peek button, and Escape does not close it', () => {
    renderShell()
    expect(document.activeElement?.textContent).toBe('Done')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('arena-shell')).not.toBeNull()
  })

  it('hides the prompt while View Battlefield is held and shows it again on release', () => {
    const { container } = renderShell()
    const backdrop = container.querySelector('.arena-prompt')!
    const peek = screen.getByRole('button', { name: t('dialogs', 'arena_view_battlefield') })
    fireEvent.pointerDown(peek)
    expect(backdrop.classList.contains('is-peek')).toBe(true)
    fireEvent.pointerUp(peek)
    expect(backdrop.classList.contains('is-peek')).toBe(false)
    fireEvent.pointerDown(peek)
    fireEvent.pointerLeave(peek)
    expect(backdrop.classList.contains('is-peek')).toBe(false)
    fireEvent.keyDown(peek, { key: ' ' })
    expect(backdrop.classList.contains('is-peek')).toBe(true)
    fireEvent.keyUp(peek, { key: ' ' })
    expect(backdrop.classList.contains('is-peek')).toBe(false)
  })

  it('Alt peeks through the shared modal', () => {
    const { container } = renderShell()
    fireEvent.keyDown(window, { key: 'Alt' })
    expect(container.querySelector('.arena-prompt')!.getAttribute('data-peek')).toBe('1')
    fireEvent.keyUp(window, { key: 'Alt' })
    expect(container.querySelector('.arena-prompt')!.getAttribute('data-peek')).toBeNull()
  })

  it('keeps the battlefield dark tokens in a light appearance', () => {
    const { container } = renderShell()
    expect(container.querySelector('.arena-prompt')!.classList.contains('board-surface')).toBe(true)
  })
})
