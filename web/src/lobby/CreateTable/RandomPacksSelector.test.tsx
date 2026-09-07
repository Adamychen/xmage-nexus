import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import RandomPacksSelector, { isRandomPacksType, maxRandomPacks } from './RandomPacksSelector'
import { getExpansionsWithBoosters } from '../../net/commands'

vi.mock('../../net/commands', () => ({
  getExpansionsWithBoosters: vi.fn(),
}))

const SETS = [
  { code: 'M21', name: 'Core Set 2021', releaseDate: 1594252800000 },
  { code: 'MH3', name: 'Modern Horizons 3', releaseDate: 1717718400000 },
  { code: 'BLB', name: 'Bloomburrow', releaseDate: 1722556800000 },
  { code: 'DSK', name: 'Duskmourn', releaseDate: 1727395200000 },
  { code: 'OTJ', name: 'Outlaws of Thunder Junction', releaseDate: 1712880000000 },
]

describe('RandomPacksSelector (T5)', () => {
  const onApply = vi.fn()
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getExpansionsWithBoosters).mockResolvedValue(SETS)
  })

  afterEach(() => {
    cleanup()
  })

  function open(type = 'Booster Draft Elimination (Random)', numPlayers = 2) {
    render(
      <RandomPacksSelector
        tournamentType={type}
        numPlayers={numPlayers}
        initialRaw=""
        onApply={onApply}
        onClose={onClose}
      />,
    )
  }

  it('lists every booster set checked by default', async () => {
    open()
    for (const s of SETS) {
      const box = await screen.findByTitle(s.name)
      expect((box.querySelector('input') as HTMLInputElement).checked).toBe(true)
    }
  })

  it('select none + apply stays disabled; select all re-enables', async () => {
    open()
    await screen.findByText('M21')
    fireEvent.click(screen.getByText(/Ninguno|None|Keine|Aucun|Nessuno|選択解除|Nenhum|Ничего|全不选/))
    expect((screen.getByTestId('random-packs-apply') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByText(/Todos|Select all|Alle|Tous|Tutti|すべて選択|Todos|Все|全选/))
    expect((screen.getByTestId('random-packs-apply') as HTMLButtonElement).disabled).toBe(false)
  })

  it('random mode shuffles and truncates to 3*(players+1)', async () => {
    open('Booster Draft Elimination (Random)', 2)
    await screen.findByText('M21')
    fireEvent.click(screen.getByTestId('random-packs-apply'))
    expect(onApply).toHaveBeenCalledTimes(1)
    const codes = onApply.mock.calls[0][0] as string[]
    // maxPacks = 3*(2+1) = 9 > 5 sets → all 5, in some order
    expect(codes).toHaveLength(5)
    expect([...codes].sort()).toEqual(['BLB', 'DSK', 'M21', 'MH3', 'OTJ'])
  })

  it('reshuffled mode keeps the full pool in server order', async () => {
    open('Booster Draft Swiss (Reshuffled)', 8)
    await screen.findByText('M21')
    fireEvent.click(screen.getByTestId('random-packs-apply'))
    expect(onApply).toHaveBeenCalledTimes(1)
    expect(onApply.mock.calls[0][0]).toEqual(['M21', 'MH3', 'BLB', 'DSK', 'OTJ'])
  })

  it('rich man truncates to 36 packs', () => {
    expect(maxRandomPacks('Booster Draft Elimination (Rich Man)', 8)).toBe(36)
    expect(maxRandomPacks('Booster Draft Elimination (Random)', 2)).toBe(9)
  })

  it('gating matches the desktop random family only', () => {
    expect(isRandomPacksType('Booster Draft Elimination (Random)')).toBe(true)
    expect(isRandomPacksType('Booster Draft Swiss (Reshuffled)')).toBe(true)
    expect(isRandomPacksType('Booster Draft Elimination (Rich Man)')).toBe(true)
    expect(isRandomPacksType('Booster Draft Elimination')).toBe(false)
    expect(isRandomPacksType('Sealed Swiss')).toBe(false)
    expect(isRandomPacksType('Booster Draft Elimination (Cube)')).toBe(false)
  })

  it('empty server list shows the manual fallback', async () => {
    vi.mocked(getExpansionsWithBoosters).mockResolvedValue([])
    open()
    await waitFor(() => {
      expect(screen.getByText(/a mano|manually|manuell|à la main|a mano|手入力|manualmente|вручную|手动/)).toBeDefined()
    })
  })
})
