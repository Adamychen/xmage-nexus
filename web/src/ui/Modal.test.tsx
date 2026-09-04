import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'
import Modal from './Modal'

describe('Modal', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders backdrop presentation wrapper and modal dialog section', () => {
    render(
      <Modal backdropClassName="mulligan-backdrop" dialogClassName="mulligan-dialog" labelledBy="mulligan-title">
        <h2 id="mulligan-title">Title</h2>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.classList.contains('mulligan-dialog')).toBe(true)
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-labelledby')).toBe('mulligan-title')
    const backdrop = dialog.parentElement
    expect(backdrop?.getAttribute('role')).toBe('presentation')
    expect(backdrop?.classList.contains('mulligan-backdrop')).toBe(true)
  })

  it('forwards accessible label and test id', () => {
    render(
      <Modal backdropClassName="x-backdrop" dialogClassName="x-dialog" label="Draft" testId="draft-modal">
        <span>body</span>
      </Modal>,
    )
    const dialog = screen.getByTestId('draft-modal')
    expect(dialog.getAttribute('aria-label')).toBe('Draft')
  })

  it('forwards backdrop clicks when a handler is provided', () => {
    const onBackdropClick = vi.fn()
    render(
      <Modal backdropClassName="x-backdrop" dialogClassName="x-dialog" labelledBy="t" onBackdropClick={onBackdropClick}>
        <h2 id="t">Title</h2>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog')
    const backdrop = dialog.parentElement as HTMLElement
    fireEvent.click(backdrop)
    expect(onBackdropClick).toHaveBeenCalledTimes(1)
  })

  it('renders trailing content inside the backdrop after the dialog', () => {
    render(
      <Modal backdropClassName="mulligan-backdrop" dialogClassName="mulligan-dialog" labelledBy="t" trailing={<div data-testid="preview">preview</div>}>
        <h2 id="t">Title</h2>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog')
    const preview = screen.getByTestId('preview')
    expect(preview.parentElement?.getAttribute('role')).toBe('presentation')
    expect(dialog.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('renders no click handler by default', () => {    const { container } = render(
      <Modal backdropClassName="voting-backdrop" dialogClassName="voting-dialog" labelledBy="voting-title">
        <h2 id="voting-title">Vote</h2>
      </Modal>,
    )
    const backdrop = container.firstElementChild as HTMLElement
    expect(backdrop.getAttribute('role')).toBe('presentation')
    fireEvent.click(backdrop)
    expect(screen.getByRole('dialog')).toBeDefined()
  })
})
