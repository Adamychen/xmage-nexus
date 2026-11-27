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

  it('DLG-14: View Battlefield stays pressed until the player asks for the question back', () => {
    const { container } = renderShell()
    const backdrop = container.querySelector('.arena-prompt')!
    const peek = screen.getByTestId('arena-prompt-peek')
    fireEvent.click(peek)
    expect(backdrop.classList.contains('is-peek')).toBe(true)
    expect(peek.getAttribute('aria-pressed')).toBe('true')
    expect(peek.textContent).toBe(t('dialogs', 'arena_back_to_prompt'))
    // the pointer leaving the button is what used to end the peek; now nothing but asking does
    fireEvent.pointerLeave(peek)
    fireEvent.pointerUp(peek)
    expect(backdrop.classList.contains('is-peek')).toBe(true)
    fireEvent.click(peek)
    expect(backdrop.classList.contains('is-peek')).toBe(false)
    expect(peek.textContent).toBe(t('dialogs', 'arena_view_battlefield'))
  })

  it('DLG-14: a click on the board while the question is aside reaches nothing, and Escape brings it back', () => {
    const { container } = renderShell()
    const backdrop = container.querySelector('.arena-prompt')!
    const board = document.createElement('button')
    const clicks: string[] = []
    board.addEventListener('click', () => clicks.push('board'))
    document.body.appendChild(board)

    fireEvent.click(screen.getByTestId('arena-prompt-peek'))
    fireEvent.click(board)
    expect(clicks, 'a look at the board is a look, never a play').toEqual([])

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(backdrop.classList.contains('is-peek')).toBe(false)
    expect(screen.queryByTestId('arena-shell'), 'Escape came back to the question, it did not answer it').not.toBeNull()
    fireEvent.click(board)
    expect(clicks).toEqual(['board'])
    board.remove()
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
