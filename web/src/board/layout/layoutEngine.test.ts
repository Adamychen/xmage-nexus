// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { BoardLayoutEngine, registrationSignature, type SeatRegistration } from './layoutEngine'
import type { ItemKind } from './itemModel'

function sized(el: HTMLElement, width: number, height: number): HTMLElement {
  Object.defineProperty(el, 'clientWidth', { value: width, configurable: true })
  Object.defineProperty(el, 'clientHeight', { value: height, configurable: true })
  return el
}

function card(): ItemKind {
  return { kind: 'card', tapped: false, attachments: 0, mutateParts: 0 }
}

function seatFixture(items: { creatures: ItemKind[]; permanents: ItemKind[] }, width = 900, height = 420) {
  const seat = document.createElement('div')
  seat.className = 'board-zone'
  const creaturesRow = sized(document.createElement('div'), width, Math.floor(height / 2))
  const creaturesBand = document.createElement('div')
  creaturesRow.appendChild(creaturesBand)
  const permanentsRow = sized(document.createElement('div'), width, Math.ceil(height / 2))
  const permanentsBand = document.createElement('div')
  permanentsRow.appendChild(permanentsBand)
  seat.append(creaturesRow, permanentsRow)
  const reg: SeatRegistration = {
    seat,
    creaturesRow,
    permanentsRow,
    own: true,
    compactPod: false,
    compact: false,
    tilted: false,
    rows: {
      creatures: items.creatures.length ? [{ id: 'creatures', el: creaturesBand, items: items.creatures }] : [],
      permanents: items.permanents.length ? [{ id: 'permanents', el: permanentsBand, items: items.permanents }] : [],
    },
  }
  return { reg, creaturesBand, permanentsBand, seat }
}

describe('BoardLayoutEngine', () => {
  it('BRD-25: the first solve writes the zone and band sizes, a second solve with the same inputs writes nothing', () => {
    const { reg, creaturesBand, permanentsBand, seat } = seatFixture({
      creatures: Array.from({ length: 7 }, card),
      permanents: [card(), card()],
    })
    const engine = new BoardLayoutEngine({ layout: 'standard', opponentsCappedByOwn: false })
    engine.register('seat', reg)
    expect(engine.flush()).toBe(true)
    expect(seat.style.getPropertyValue('--zone-card-w')).toMatch(/^\d+px$/)
    expect(seat.style.getPropertyValue('--card-w')).toBe(seat.style.getPropertyValue('--zone-card-w'))
    expect(creaturesBand.style.flexBasis).toMatch(/^\d+px$/)
    expect(creaturesBand.style.getPropertyValue('--card-w')).toMatch(/^\d+px$/)
    expect(permanentsBand.style.flexBasis).toMatch(/^\d+px$/)
    expect(engine.flush()).toBe(false)
  })

  it('BRD-26: a band whose items leave the seat is cleared on the next solve', () => {
    const { reg, creaturesBand } = seatFixture({ creatures: [card()], permanents: [card()] })
    const engine = new BoardLayoutEngine({ layout: 'standard', opponentsCappedByOwn: false })
    engine.register('seat', reg)
    engine.flush()
    expect(creaturesBand.style.flexBasis).not.toBe('')
    const emptied = { ...reg, rows: { ...reg.rows, creatures: [{ ...reg.rows.creatures[0], items: [] }] } }
    engine.register('seat', emptied)
    expect(engine.flush()).toBe(true)
    expect(creaturesBand.style.flexBasis).toBe('')
    expect(creaturesBand.style.getPropertyValue('--card-w')).toBe('')
  })

  it('BRD-26: a band taken out of flow (a docked command zone) takes no room in its row and is cleared', () => {
    const { reg, creaturesBand } = seatFixture({ creatures: [card(), card()], permanents: [card()] })
    const docked = document.createElement('div')
    reg.rows.creatures.unshift({ id: 'commander', el: docked, items: [{ kind: 'commander', commanders: 1, compactPod: false }], maxLines: 1 })
    docked.style.position = 'absolute'
    reg.seat.appendChild(docked)
    const engine = new BoardLayoutEngine({ layout: 'arena', opponentsCappedByOwn: true })
    engine.register('seat', reg)
    engine.flush()
    expect(docked.style.flexBasis).toBe('')
    expect(creaturesBand.style.flexBasis).toBe('900px')
  })

  it('BRD-25: a seat without a size is left out and writes nothing', () => {
    const { reg, seat } = seatFixture({ creatures: [card()], permanents: [] }, 0, 0)
    const engine = new BoardLayoutEngine({ layout: 'standard', opponentsCappedByOwn: false })
    engine.register('seat', reg)
    expect(engine.flush()).toBe(false)
    expect(seat.style.getPropertyValue('--zone-card-w')).toBe('')
  })

  it('BRD-25: the own seat card width is reported to the owner', () => {
    const { reg } = seatFixture({ creatures: [card()], permanents: [card()] })
    const engine = new BoardLayoutEngine({ layout: 'standard', opponentsCappedByOwn: false })
    let reported: number | undefined = -1
    engine.onSolved = (w) => {
      reported = w
    }
    engine.register('seat', reg)
    engine.flush()
    expect(reported).toBeGreaterThan(0)
    expect(reported).toBe(parseFloat(reg.seat.style.getPropertyValue('--zone-card-w')))
  })

  it('BRD-25: the registration signature changes with the items and stays put otherwise', () => {
    const { reg } = seatFixture({ creatures: [card()], permanents: [card()] })
    const same = { ...reg, rows: { ...reg.rows } }
    expect(registrationSignature(same)).toBe(registrationSignature(reg))
    const more = { ...reg, rows: { ...reg.rows, creatures: [{ ...reg.rows.creatures[0], items: [card(), card()] }] } }
    expect(registrationSignature(more)).not.toBe(registrationSignature(reg))
  })
})
