// @vitest-environment jsdom
import { cleanup, render, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DraftScreen from './DraftScreen'
import { reset } from '../state/store'
import { setState } from '../state/state'
import { soundManager } from '../audio/soundManager'
import type { DraftClientMessage } from '../net/types'

const mockSendCardPick = vi.fn().mockResolvedValue({ ok: true })
const mockSendCardMark = vi.fn().mockResolvedValue({ ok: true })
const mockSetBoosterLoaded = vi.fn().mockResolvedValue({ ok: true })
const mockQuitDraft = vi.fn().mockResolvedValue({ ok: true })

vi.mock('../net/commands', () => ({
  sendCardPick: (...args: unknown[]) => mockSendCardPick(...args),
  sendCardMark: (...args: unknown[]) => mockSendCardMark(...args),
  setBoosterLoaded: (...args: unknown[]) => mockSetBoosterLoaded(...args),
  quitDraft: (...args: unknown[]) => mockQuitDraft(...args),
}))

function makeDraftMessage(overrides: Partial<DraftClientMessage> = {}): DraftClientMessage {
  return {
    draftView: {
      setNames: ['Core Set 2021'],
      setCodes: ['M21'],
      boosterNum: 1,
      cardNum: 1,
      players: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
    },
    draftPickView: {
      booster: {
        'c-1': { id: 'c-1', expansionSetCode: 'M21', cardNumber: '1', name: 'Lightning Bolt' },
        'c-2': { id: 'c-2', expansionSetCode: 'M21', cardNumber: '2', name: 'Grizzly Bears' },
      },
      picks: {},
      picking: true,
      timeout: 60,
    },
    ...overrides,
  }
}

describe('DraftScreen', () => {
  beforeEach(() => {
    reset()
    vi.clearAllMocks()
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        name: 'Mock Card',
        type_line: 'Creature',
        mana_cost: '{1}{G}',
        cmc: 2,
        colors: ['G'],
        legalities: {},
        image_uris: { normal: 'https://img.test/n.jpg', art_crop: 'https://img.test/a.jpg' },
      }),
    } as unknown as Response)
  })

  afterEach(() => {
    cleanup()
    reset()
    vi.restoreAllMocks()
  })

  it('does not render when draft is null', () => {
    const { container } = render(<DraftScreen />)
    expect(container.querySelector('.draft-backdrop')).toBeNull()
  })

  it('renders booster and timeout', async () => {
    setState({ draft: { draftId: 'draft-1', message: makeDraftMessage() } })
    const { container, getByTestId } = render(<DraftScreen />)
    expect(container.querySelector('.draft-backdrop')).toBeTruthy()
    expect(getByTestId('draft-booster')).toBeTruthy()
    expect(getByTestId('draft-timeout').textContent).toMatch(/1:00|0:60/)
    expect(container.textContent).toContain('Booster 1')
    expect(container.textContent).toContain('M21')
    expect(container.textContent).toContain('Tu turno')
  })

  it('shows picking vs waiting states', () => {
    setState({ draft: { draftId: 'draft-1', message: makeDraftMessage({ draftPickView: { booster: { 'c-1': { id: 'c-1', expansionSetCode: 'M21', cardNumber: '1' } }, picks: {}, picking: false, timeout: 30 } }) } })
    const { container } = render(<DraftScreen />)
    expect(container.textContent).toContain('Esperando')
    const cards = container.querySelectorAll('[data-testid="draft-card"]')
    expect(cards.length).toBeGreaterThan(0)
    for (const c of Array.from(cards)) {
      expect((c as HTMLButtonElement).disabled).toBe(true)
    }
  })

  it('click card triggers sendCardPick', async () => {
    setState({ draft: { draftId: 'draft-1', message: makeDraftMessage() } })
    const { container } = render(<DraftScreen />)
    const card = container.querySelector('[data-testid="draft-card"]') as HTMLButtonElement
    expect(card).toBeTruthy()
    await fireEvent.click(card)
    await waitFor(() => expect(mockSendCardPick).toHaveBeenCalledWith('draft-1', expect.any(String), undefined))
    expect(mockSetBoosterLoaded).toHaveBeenCalled()
  })

  it('right click triggers sendCardMark', async () => {
    setState({ draft: { draftId: 'draft-1', message: makeDraftMessage() } })
    const { container } = render(<DraftScreen />)
    const card = container.querySelector('[data-testid="draft-card"]') as HTMLButtonElement
    expect(card).toBeTruthy()
    await fireEvent.contextMenu(card)
    await waitFor(() => expect(mockSendCardMark).toHaveBeenCalledWith('draft-1', expect.any(String)))
  })

  it('shows picks tray', () => {
    setState({
      draft: {
        draftId: 'draft-1',
        message: makeDraftMessage({
          draftPickView: {
            booster: { 'c-1': { id: 'c-1', expansionSetCode: 'M21', cardNumber: '1', name: 'Bolt' } },
            picks: { 'p-1': { id: 'p-1', expansionSetCode: 'M21', cardNumber: '99', name: 'Bear' } },
            picking: true,
            timeout: 45,
          },
        }),
      },
    })
    const { container, getByTestId } = render(<DraftScreen />)
    expect(getByTestId('draft-picks')).toBeTruthy()
    expect(container.textContent).toContain('Tus picks')
  })

  it('calls setBoosterLoaded on mount when booster exists', async () => {
    setState({ draft: { draftId: 'draft-1', message: makeDraftMessage() } })
    render(<DraftScreen />)
    await waitFor(() => expect(mockSetBoosterLoaded).toHaveBeenCalledWith('draft-1'))
  })

  it('hides a pick and sends hiddenCards with the next pick (U9-1)', async () => {
    setState({
      draft: {
        draftId: 'draft-1',
        message: makeDraftMessage({
          draftPickView: {
            booster: { 'c-1': { id: 'c-1', expansionSetCode: 'M21', cardNumber: '1', name: 'Bolt' } },
            picks: { 'p-1': { id: 'p-1', expansionSetCode: 'M21', cardNumber: '99', name: 'Bear' } },
            picking: true,
            timeout: 45,
          },
        }),
      },
    })
    const { container } = render(<DraftScreen />)
    expect(container.querySelectorAll('[data-testid="draft-pick-card"]').length).toBe(1)
    await fireEvent.click(container.querySelector('[data-testid="draft-pick-hide"]')!)
    expect(container.querySelectorAll('[data-testid="draft-pick-card"]').length).toBe(0)
    expect(container.textContent).toContain('oculta')
    await fireEvent.click(container.querySelector('[data-testid="draft-card"]') as HTMLButtonElement)
    await waitFor(() => expect(mockSendCardPick).toHaveBeenCalledWith('draft-1', 'c-1', ['p-1']))
  })

  it('F9 shows hidden picks again (U9-1)', async () => {
    setState({
      draft: {
        draftId: 'draft-1',
        message: makeDraftMessage({
          draftPickView: {
            booster: {},
            picks: { 'p-1': { id: 'p-1', expansionSetCode: 'M21', cardNumber: '99', name: 'Bear' } },
            picking: false,
            timeout: 45,
          },
        }),
      },
    })
    const { container } = render(<DraftScreen />)
    await fireEvent.click(container.querySelector('[data-testid="draft-pick-hide"]')!)
    expect(container.querySelectorAll('[data-testid="draft-pick-card"]').length).toBe(0)
    await fireEvent.keyDown(window, { key: 'F9' })
    expect(container.querySelectorAll('[data-testid="draft-pick-card"]').length).toBe(1)
  })

  it('quit asks for confirmation (U9-2)', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    setState({ draft: { draftId: 'draft-1', message: makeDraftMessage() } })
    const { container } = render(<DraftScreen />)
    await fireEvent.click(container.querySelector('.draft-quit-btn')!)
    expect(confirmSpy).toHaveBeenCalled()
    expect(mockQuitDraft).not.toHaveBeenCalled()
    confirmSpy.mockReturnValue(true)
    await fireEvent.click(container.querySelector('.draft-quit-btn')!)
    await waitFor(() => expect(mockQuitDraft).toHaveBeenCalledWith('draft-1'))
    confirmSpy.mockRestore()
  })

  it('renders table seats with passing direction (U9-3)', () => {
    setState({ draft: { draftId: 'draft-1', message: makeDraftMessage() } })
    const { container, getByTestId } = render(<DraftScreen />)
    const table = getByTestId('draft-table')
    expect(table.textContent).toContain('←')
    expect(table.querySelectorAll('.draft-seat').length).toBe(8)
    expect(container.textContent).toContain('a')
  })

  it('ignores a second pick within the protection window (U9-5)', async () => {
    setState({ draft: { draftId: 'draft-1', message: makeDraftMessage() } })
    const { container } = render(<DraftScreen />)
    const cards = container.querySelectorAll('[data-testid="draft-card"]')
    await fireEvent.click(cards[0] as HTMLButtonElement)
    await fireEvent.click(cards[1] as HTMLButtonElement)
    await waitFor(() => expect(mockSendCardPick).toHaveBeenCalledTimes(1))
  })

  it('warns at <=30s and ticks audio at 6s (U9-4)', async () => {
    const playSpy = vi.spyOn(soundManager, 'play').mockImplementation(() => {})
    try {
      setState({
        draft: {
          draftId: 'draft-1',
          message: makeDraftMessage({
            draftPickView: {
              booster: { 'c-1': { id: 'c-1', expansionSetCode: 'M21', cardNumber: '1', name: 'Bolt' } },
              picks: {},
              picking: true,
              timeout: 25,
            },
          }),
        },
      })
      const { container, unmount } = render(<DraftScreen />)
      expect(container.querySelector('.draft-timer.warn')).toBeTruthy()
      expect(container.querySelector('.draft-timer.urgent')).toBeNull()
      unmount()
      cleanup()
      setState({
        draft: {
          draftId: 'draft-2',
          message: makeDraftMessage({
            draftPickView: {
              booster: { 'c-1': { id: 'c-1', expansionSetCode: 'M21', cardNumber: '1', name: 'Bolt' } },
              picks: {},
              picking: true,
              timeout: 6,
            },
          }),
        },
      })
      const r2 = render(<DraftScreen />)
      expect(r2.container.querySelector('.draft-timer.urgent')).toBeTruthy()
      await waitFor(() => expect(playSpy).toHaveBeenCalledWith('timer_tick', 'game'))
    } finally {
      playSpy.mockRestore()
    }
  })

  it('sorts the booster by rarity once known (U9-7)', async () => {
    globalThis.fetch = vi.fn(async (url: unknown) => ({
      ok: true,
      json: async () => ({
        name: 'Mock Card',
        type_line: 'Creature',
        mana_cost: '{1}{G}',
        cmc: 2,
        colors: ['G'],
        rarity: String(url).includes('/M21/1?') ? 'rare' : 'common',
        legalities: {},
        image_uris: { normal: 'https://img.test/n.jpg', art_crop: 'https://img.test/a.jpg' },
      }),
    }) as unknown as Response)
    setState({ draft: { draftId: 'draft-1', message: makeDraftMessage() } })
    const { container } = render(<DraftScreen />)
    await waitFor(() => {
      const cards = container.querySelectorAll('[data-testid="draft-card"]')
      expect(cards[0].getAttribute('data-card-id')).toBe('c-2')
    })
  })
})
