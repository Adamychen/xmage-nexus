import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { createPortal } from 'react-dom'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

const SETTLE = 200

describe('GameStrip: colocación del desplegable mientras el layout se asienta', () => {
  let rowBottom = 96
  let notify: (() => void) | null = null

  const rect = (top: number, bottom: number) =>
    ({ top, bottom, left: 0, right: 100, width: 100, height: bottom - top, x: 0, y: top, toJSON: () => ({}) }) as DOMRect

  beforeEach(() => {
    vi.useFakeTimers()
    rowBottom = 96
    notify = null
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (this.classList.contains('board-shell')) return rect(0, 900)
      if (this.classList.contains('game-strip-right')) return rect(436, 460)
      if (this.classList.contains('oz-top-row')) return rect(0, rowBottom)
      return rect(0, 0)
    })
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          notify = cb
        }
        observe() {}
        disconnect() {}
      },
    )
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function Board() {
    const [slot, setSlot] = useState<HTMLElement | null>(null)
    return (
      <DividerSlotContext.Provider value={setSlot}>
        <div className="board-shell">
          <div className="oz-top-row" />
          <BoardDivider />
        </div>
        {slot && createPortal(<GameStrip left={null} center={null} right={null} dropdown={<span />} />, slot)}
      </DividerSlotContext.Provider>
    )
  }

  const side = (c: HTMLElement) => c.querySelector('.game-strip-right')?.getAttribute('data-dropdown-side')

  it('con espacio arriba se abre hacia arriba y no espera nada', () => {
    const { container } = render(<Board />)
    expect(side(container)).toBe('up')
  })

  it('una altura provisional que no cabe no lo baja al instante: primero espera a que se asiente', () => {
    rowBottom = 208
    const { container } = render(<Board />)
    expect(side(container)).toBe('up')

    act(() => { vi.advanceTimersByTime(SETTLE + 50) })
    expect(side(container)).toBe('down')
  })

  it('si la fila acaba encogiendo antes de asentarse, nunca llega a bajar', () => {
    rowBottom = 208
    const { container } = render(<Board />)
    expect(side(container)).toBe('up')

    act(() => { vi.advanceTimersByTime(80) })
    rowBottom = 96
    act(() => { notify?.() })
    expect(side(container)).toBe('up')

    act(() => { vi.advanceTimersByTime(SETTLE * 3) })
    expect(side(container)).toBe('up')
  })

  it('cada cambio de geometría reinicia la espera', () => {
    rowBottom = 300
    const { container } = render(<Board />)
    act(() => { vi.advanceTimersByTime(SETTLE - 20) })
    rowBottom = 310
    act(() => { notify?.() })
    act(() => { vi.advanceTimersByTime(SETTLE - 20) })
    expect(side(container)).toBe('up')

    act(() => { vi.advanceTimersByTime(40) })
    expect(side(container)).toBe('down')
  })

  it('un clic del usuario mide y aplica al momento, sin esperar', () => {
    rowBottom = 300
    const { container } = render(<Board />)
    expect(side(container)).toBe('up')

    fireEvent.pointerDown(container.querySelector('.game-strip-right') as HTMLElement)
    expect(side(container)).toBe('down')
  })

  it('una vez abajo, volver a subir es inmediato', () => {
    rowBottom = 300
    const { container } = render(<Board />)
    act(() => { vi.advanceTimersByTime(SETTLE + 50) })
    expect(side(container)).toBe('down')

    rowBottom = 96
    act(() => { notify?.() })
    expect(side(container)).toBe('up')
  })
})
