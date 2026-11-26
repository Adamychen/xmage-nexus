// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BoardLayoutProvider, BoardLayoutSeat } from './BoardLayoutProvider'
import type { ItemKind } from './itemModel'
import type { SeatRegistration } from './layoutEngine'

function sized(el: HTMLElement, width: number, height: number): HTMLElement {
  Object.defineProperty(el, 'clientWidth', { value: width, configurable: true })
  Object.defineProperty(el, 'clientHeight', { value: height, configurable: true })
  return el
}

function card(): ItemKind {
  return { kind: 'card', tapped: false, attachments: 0, mutateParts: 0 }
}

function seatRegistration(creatures: number): { reg: SeatRegistration; seat: HTMLElement; band: HTMLElement } {
  const seat = document.createElement('div')
  seat.className = 'board-zone'
  const creaturesRow = sized(document.createElement('div'), 900, 210)
  const band = document.createElement('div')
  creaturesRow.appendChild(band)
  const permanentsRow = sized(document.createElement('div'), 900, 210)
  const permanentsBand = document.createElement('div')
  permanentsRow.appendChild(permanentsBand)
  seat.append(creaturesRow, permanentsRow)
  document.body.appendChild(seat)
  return {
    seat,
    band,
    reg: {
      seat,
      creaturesRow,
      permanentsRow,
      own: true,
      compactPod: false,
      compact: false,
      tilted: false,
      rows: {
        creatures: [{ id: 'creatures', el: band, items: Array.from({ length: creatures }, card), evenLines: true }],
        permanents: [{ id: 'permanents', el: permanentsBand, items: [card()] }],
      },
    },
  }
}

function Board({ reg }: { reg: SeatRegistration }) {
  const boardRef = useRef<HTMLElement | null>(null)
  return (
    <BoardLayoutProvider boardRef={boardRef} layout="standard">
      <BoardLayoutSeat reg={reg} />
    </BoardLayoutProvider>
  )
}

describe('BRD-67: a seat joining a board', () => {
  let frames: Array<FrameRequestCallback>

  beforeEach(() => {
    frames = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(cb)
      return frames.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('BRD-67: is solved before the frame the engine asks for, which this test never runs', async () => {
    const { reg, seat, band } = seatRegistration(7)
    render(<Board reg={reg} />)
    await Promise.resolve()

    expect(frames.length, 'the engine also asks for a frame, which this test never runs').toBeGreaterThan(0)
    expect(seat.style.getPropertyValue('--card-w')).toMatch(/^\d+px$/)
    expect(band.style.getPropertyValue('--card-w')).toMatch(/^\d+px$/)
    expect(band.style.flexBasis).toMatch(/^\d+px$/)
  })

  it('BRD-67: a seat that gains cards is solved again before that frame, not at the previous card size', async () => {
    const { reg, band } = seatRegistration(2)
    const { rerender } = render(<Board reg={reg} />)
    await Promise.resolve()
    const few = band.style.getPropertyValue('--card-w')
    expect(few).toMatch(/^\d+px$/)

    const crowded = seatRegistration(24)
    crowded.reg.seat = reg.seat
    crowded.reg.creaturesRow = reg.creaturesRow
    crowded.reg.permanentsRow = reg.permanentsRow
    crowded.reg.rows.creatures[0].el = reg.rows.creatures[0].el
    crowded.reg.rows.permanents[0].el = reg.rows.permanents[0].el
    rerender(<Board reg={crowded.reg} />)
    await Promise.resolve()

    expect(parseFloat(band.style.getPropertyValue('--card-w'))).toBeLessThan(parseFloat(few))
    expect(band.getAttribute('data-band-lines'), 'the crowded band was given its lines too').toBe('2')
  })
})
