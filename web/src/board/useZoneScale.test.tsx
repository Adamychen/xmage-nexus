import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, act } from '@testing-library/react'
import { useZoneScale } from './useZoneScale'
import { useState } from 'react'

function TestZone({ initialAttach = true }: { initialAttach?: boolean }) {
  const { cardW, ref } = useZoneScale()
  const [attached, setAttached] = useState(initialAttach)

  return (
    <div>
      <button type="button" onClick={() => setAttached(!attached)}>
        toggle
      </button>
      {attached && (
        <div
          ref={ref}
          className="board-zone player-zone"
          data-testid="zone"
          style={{ height: 400, width: 800 }}
        >
          <div className="bz-status-row" style={{ height: 44 }} />
          <span data-testid="card-w">{cardW}</span>
        </div>
      )}
    </div>
  )
}

describe('useZoneScale', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    Element.prototype.getBoundingClientRect = function () {
      if (this.classList?.contains('board-zone')) {
        return {
          width: 800,
          height: 400,
          top: 0,
          left: 0,
          right: 800,
          bottom: 400,
          x: 0,
          y: 0,
          toJSON: () => {},
        } as DOMRect
      }
      return {
        width: 100,
        height: 44,
        top: 0,
        left: 0,
        right: 100,
        bottom: 44,
        x: 0,
        y: 0,
        toJSON: () => {},
      } as DOMRect
    }
  })

  it('measures card width when initially attached', () => {
    const { getByTestId } = render(<TestZone initialAttach={true} />)
    const cardWText = getByTestId('card-w').textContent
    const cardW = Number(cardWText)
    expect(cardW).toBeGreaterThan(100)
  })

  it('reactively measures card width when mounted after delay (e.g. game loaded after mount)', () => {
    const { getByTestId, getByRole, queryByTestId } = render(<TestZone initialAttach={false} />)
    expect(queryByTestId('zone')).toBeNull()

    // Attach the element now
    act(() => {
      getByRole('button', { name: 'toggle' }).click()
    })

    expect(queryByTestId('zone')).not.toBeNull()
    const cardWText = getByTestId('card-w').textContent
    const cardW = Number(cardWText)
    expect(cardW).toBeGreaterThan(100)
  })
})
