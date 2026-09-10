import { describe, expect, it, beforeEach } from 'vitest'
import { mergeDraftMessage, handleConstruct } from './draft'
import { getState, setState } from '../state'
import type { DraftClientMessage } from '../../net/types.generated'

const card = (id: string) => ({ id, name: `Card ${id}` })
const view = (over: Record<string, unknown> = {}) => ({
  setNames: ['Core Set 2021'],
  setCodes: ['M21'],
  boosterNum: 1,
  cardNum: 1,
  players: ['a', 'b'],
  ...over,
})
const msg = (pickView: unknown, vOver: Record<string, unknown> = {}) =>
  ({ draftView: view(vOver), draftPickView: pickView }) as unknown as DraftClientMessage

describe('mergeDraftMessage', () => {
  it('DRAFT_UPDATE sin booster conserva el sobre anterior', () => {
    const prev = {
      draftId: 'd1',
      message: msg({ booster: { c1: card('c1'), c2: card('c2') }, picks: {}, picking: true, timeout: 100 }),
    }
    const next = mergeDraftMessage(prev, 'd1', msg({ picking: true, timeout: 98 }))
    const pv = next.message.draftPickView as unknown as { booster: Record<string, unknown> }
    expect(Object.keys(pv.booster)).toEqual(['c1', 'c2'])
    expect(next.draftId).toBe('d1')
  })

  it('los picks se acumulan entre updates', () => {
    const prev = {
      draftId: 'd1',
      message: msg({ booster: { c2: card('c2') }, picks: { p1: card('p1') }, picking: true, timeout: 100 }),
    }
    const next = mergeDraftMessage(
      prev,
      'd1',
      msg({ booster: { c2: card('c2') }, picks: { p1: card('p1'), p2: card('p2') }, picking: true, timeout: 95 }),
    )
    const pv = next.message.draftPickView as unknown as { picks: Record<string, unknown> }
    expect(Object.keys(pv.picks).sort()).toEqual(['p1', 'p2'])
  })

  it('sobre nuevo reemplaza al anterior', () => {
    const prev = {
      draftId: 'd1',
      message: msg({ booster: { c1: card('c1') }, picks: {}, picking: true, timeout: 100 }),
    }
    const next = mergeDraftMessage(
      prev,
      'd1',
      msg({ booster: { c3: card('c3') }, picks: {}, picking: true, timeout: 100 }),
    )
    const pv = next.message.draftPickView as unknown as { booster: Record<string, unknown> }
    expect(Object.keys(pv.booster)).toEqual(['c3'])
  })

  it('cambio de sobre descarta el resto anterior', () => {
    const prev = {
      draftId: 'd1',
      message: msg({ booster: { c1: card('c1') }, picks: { p1: card('p1') }, picking: true, timeout: 100 }, { boosterNum: 1 }),
    }
    const next = mergeDraftMessage(prev, 'd1', msg({ picking: false, timeout: 100 }, { boosterNum: 2 }))
    const pv = next.message.draftPickView as unknown as { booster: Record<string, unknown>; picks: Record<string, unknown> }
    expect(Object.keys(pv.booster)).toEqual([])
    expect(Object.keys(pv.picks)).toEqual(['p1'])
  })

  it('otro draftId reinicia sin arrastrar estado', () => {
    const prev = {
      draftId: 'd1',
      message: msg({ booster: { c1: card('c1') }, picks: { p1: card('p1') }, picking: true, timeout: 100 }),
    }
    const next = mergeDraftMessage(
      prev,
      'd2',
      msg({ booster: { c9: card('c9') }, picks: {}, picking: true, timeout: 100 }),
    )
    expect(next.draftId).toBe('d2')
    const pv = next.message.draftPickView as unknown as { booster: Record<string, unknown>; picks: Record<string, unknown> }
    expect(Object.keys(pv.booster)).toEqual(['c9'])
    expect(Object.keys(pv.picks)).toEqual([])
  })
})

describe('handleConstruct — el pool vive en sideboard', () => {
  const poolCard = (id: string) => ({
    id,
    expansionSetCode: 'M21',
    cardNumber: '39',
    usesVariousArt: false,
    gameObject: false,
  })
  beforeEach(() => {
    setState({ construct: null, draft: null } as never)
  })

  it('usa sideboard como pool (forma real del servidor: cards vacío)', () => {
    handleConstruct(
      {
        deck: { name: null, cards: {}, sideboard: { a: poolCard('a'), b: poolCard('b') } },
        currentTableId: 't1',
        parentTableId: null,
        time: 599,
      },
      null,
    )
    const c = getState().construct
    expect(c).not.toBeNull()
    expect(Object.keys(c?.pool ?? {}).sort()).toEqual(['a', 'b'])
    expect(c?.timeLeft).toBe(599)
  })

  it('acepta pool en cards si viene ahí', () => {
    handleConstruct({ deck: { cards: { a: poolCard('a') } }, currentTableId: 't1' }, null)
    expect(Object.keys(getState().construct?.pool ?? {})).toEqual(['a'])
  })

  it('une sideboard y cards sin duplicar', () => {
    handleConstruct(
      { deck: { cards: { a: poolCard('a') }, sideboard: { b: poolCard('b') } }, currentTableId: 't1' },
      null,
    )
    expect(Object.keys(getState().construct?.pool ?? {}).sort()).toEqual(['a', 'b'])
  })

  it('sin mesa no abre construcción', () => {
    handleConstruct({ deck: { cards: {} } }, null)
    expect(getState().construct).toBeNull()
  })
})

describe('watchdog post-DRAFT_OVER', () => {
  it('isConstructStalled: solo salta con over antiguo y sin construct', async () => {
    const { isConstructStalled, DRAFT_OVER_WATCHDOG_MS } = await import('./draft')
    const now = 1_000_000
    expect(isConstructStalled(null, false, now)).toBe(false)
    expect(isConstructStalled(undefined, false, now)).toBe(false)
    expect(isConstructStalled(now - 1000, false, now)).toBe(false)
    expect(isConstructStalled(now - DRAFT_OVER_WATCHDOG_MS, false, now)).toBe(true)
    expect(isConstructStalled(now - DRAFT_OVER_WATCHDOG_MS - 1, true, now)).toBe(false)
  })

  it('handleDraftOver marca y handleConstruct limpia', async () => {
    const { handleDraftOver, handleConstruct } = await import('./draft')
    setState({ construct: null, draft: null, draftOverAt: null } as never)
    handleDraftOver('d1')
    expect(typeof getState().draftOverAt).toBe('number')
    handleConstruct({ deck: { cards: {} }, currentTableId: 't1' }, null)
    expect(getState().draftOverAt).toBeNull()
  })

  it('handleStartDraft limpia marcas viejas', async () => {
    const { handleStartDraft } = await import('./draft')
    setState({ draftOverAt: 123, conn: { username: 'p' } } as never)
    handleStartDraft(null, null)
    expect(getState().draftOverAt).toBeNull()
  })
})

describe('watchdog mitad del draft', () => {
  it('isDraftStalled: solo con draft activo y silencio largo', async () => {
    const { isDraftStalled, DRAFT_STALL_MS } = await import('./draft')
    const now = 2_000_000
    expect(isDraftStalled(null, true, now)).toBe(false)
    expect(isDraftStalled(now - 1000, true, now)).toBe(false)
    expect(isDraftStalled(now - 1000, false, now)).toBe(false)
    expect(isDraftStalled(now - DRAFT_STALL_MS, true, now)).toBe(true)
    expect(isDraftStalled(now - DRAFT_STALL_MS - 1, false, now)).toBe(false)
  })

  it('handleDraftUpdate sella el instante; over/construct lo limpian', async () => {
    const { handleDraftUpdate, handleDraftOver, handleConstruct } = await import('./draft')
    setState({ draft: null, draftOverAt: null, lastDraftEventAt: null } as never)
    handleDraftUpdate('DRAFT_PICK', 'd1', { draftView: { boosterNum: 1 } } as never)
    expect(typeof getState().lastDraftEventAt).toBe('number')
    handleDraftOver('d1')
    expect(getState().lastDraftEventAt).toBeNull()
    setState({ lastDraftEventAt: 111 } as never)
    handleConstruct({ deck: { cards: {} }, currentTableId: 't1' }, null)
    expect(getState().lastDraftEventAt).toBeNull()
  })
})
