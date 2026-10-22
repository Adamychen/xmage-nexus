import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Modal from './Modal'
import { useEscape } from './useEscape'

afterEach(cleanup)

function Overlay({ onClose, testId }: { onClose: () => void; testId: string }) {
  useEscape(onClose)
  return <div data-testid={testId} />
}

describe('useEscape layer stack', () => {
  it('DLG-2: closes only the topmost layer on one Escape', () => {
    const onOverlay = vi.fn()
    const onModal = vi.fn()
    render(
      <>
        <Overlay onClose={onOverlay} testId="overlay" />
        <Modal backdropClassName="b" dialogClassName="d" labelledBy="t" onEscape={onModal}>
          <h2 id="t">Dialog</h2>
        </Modal>
      </>,
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onModal).toHaveBeenCalledTimes(1)
    expect(onOverlay).not.toHaveBeenCalled()
  })

  it('DLG-2: hands Escape to the layer beneath once the top one unmounts', () => {
    const lower = vi.fn()
    const upper = vi.fn()
    const { rerender } = render(<Overlay onClose={lower} testId="lower" />)
    rerender(
      <>
        <Overlay onClose={lower} testId="lower" />
        <Overlay onClose={upper} testId="upper" />
      </>,
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(upper).toHaveBeenCalledTimes(1)
    expect(lower).not.toHaveBeenCalled()

    rerender(<Overlay onClose={lower} testId="lower" />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(lower).toHaveBeenCalledTimes(1)
    expect(upper).toHaveBeenCalledTimes(1)
  })

  it('DLG-2: keeps the stack order when an overlay re-renders with a new callback', () => {
    const lower = vi.fn()
    const upper = vi.fn()
    const { rerender } = render(
      <>
        <Overlay onClose={lower} testId="lower" />
        <Overlay onClose={upper} testId="upper" />
      </>,
    )
    rerender(
      <>
        <Overlay onClose={() => lower()} testId="lower" />
        <Overlay onClose={() => upper()} testId="upper" />
      </>,
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(upper).toHaveBeenCalledTimes(1)
    expect(lower).not.toHaveBeenCalled()
  })
})
