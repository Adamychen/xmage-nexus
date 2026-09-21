import { cleanup, render } from '@testing-library/react'
import { createPortal } from 'react-dom'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import GameStrip from './GameStrip'
import { BoardDivider, DividerSlotContext } from '../board/BoardShell'

function Harness({ withSlot }: { withSlot: boolean }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  return (
    <DividerSlotContext.Provider value={withSlot ? setSlot : null}>
      <div className="board-shell">
        <BoardDivider labels />
      </div>
      {slot &&
        createPortal(
          <GameStrip left={<span data-testid="left" />} center={<span data-testid="center" />} right={<span data-testid="right" />} dropdown={<span data-testid="dropdown" />} />,
          slot
        )}
    </DividerSlotContext.Provider>
  )
}

describe('GameStrip y hueco del divisor', () => {
  afterEach(() => {
    cleanup()
  })

  it('el divisor publica su hueco y aloja la franja con sus cuatro zonas', () => {
    const { getByTestId, container } = render(<Harness withSlot />)
    const divider = container.querySelector('.board-shell-divider') as HTMLElement
    expect(divider.className).toContain('has-strip')
    expect(divider.className).not.toContain('with-labels')
    const strip = getByTestId('game-strip')
    expect(divider.contains(strip)).toBe(true)
    expect(strip.querySelector('.game-strip-left')?.contains(getByTestId('left'))).toBe(true)
    expect(strip.querySelector('.game-strip-center')?.contains(getByTestId('center'))).toBe(true)
    expect(strip.querySelector('.game-strip-right')?.contains(getByTestId('right'))).toBe(true)
    expect(strip.querySelector('.game-strip-right')?.contains(getByTestId('dropdown'))).toBe(true)
  })

  it('sin hueco publicado el divisor conserva sus etiquetas decorativas', () => {
    const { container, queryByTestId } = render(<Harness withSlot={false} />)
    const divider = container.querySelector('.board-shell-divider') as HTMLElement
    expect(divider.className).toContain('with-labels')
    expect(divider.className).not.toContain('has-strip')
    expect(queryByTestId('game-strip')).toBeNull()
  })

  it('el desplegable declara hacia dónde se abre y su alto máximo', () => {
    const { getByTestId } = render(<Harness withSlot />)
    const right = getByTestId('game-strip').querySelector('.game-strip-right') as HTMLElement
    expect(['up', 'down']).toContain(right.getAttribute('data-dropdown-side'))
    expect(right.style.getPropertyValue('--dd-max')).toMatch(/^\d+px$/)
  })
})
