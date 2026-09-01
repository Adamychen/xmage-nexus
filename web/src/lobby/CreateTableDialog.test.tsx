import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import CreateTableDialog from './CreateTableDialog'
import * as cmds from '../net/commands'

vi.mock('../net/commands', () => ({
  getGameTypes: vi.fn().mockResolvedValue([
    { name: 'Two Player Duel', minPlayers: 2, maxPlayers: 2 },
    { name: 'Commander Free For All', minPlayers: 3, maxPlayers: 10 },
  ]),
  getDeckTypes: vi.fn().mockResolvedValue(['Constructed - Modern', 'Constructed - Standard', 'Variant Magic - Commander']),
  getPlayerTypes: vi.fn().mockResolvedValue(['COMPUTER_MAD', 'COMPUTER_DRAFT']),
  createTable: vi.fn().mockResolvedValue({ ok: true, data: { tableId: 'table-123' } }),
  joinTable: vi.fn().mockResolvedValue({ ok: true }),
}))

describe('CreateTableDialog', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders modern create table dialog with navigation tabs', async () => {
    render(<CreateTableDialog onClose={onClose} />)

    expect(screen.getByRole('heading', { name: /Crear Mesa|Create Table/ })).toBeDefined()
    expect(screen.getByText(/⚙️ General/)).toBeDefined()
    expect(screen.getByText(/⏱️ Tiempos & Reglas|Timers & Rules/)).toBeDefined()
    expect(screen.getByText(/🛡️/)).toBeDefined()
    expect(screen.getByText(/Multijugador|Multiplayer/)).toBeDefined()
  })

  it('allows navigating to Timing tab and setting custom clocks and mulligans', async () => {
    render(<CreateTableDialog onClose={onClose} />)

    // Switch to Timing tab
    const timingTab = screen.getByText(/⏱️ Tiempos & Reglas|Timers & Rules/)
    fireEvent.click(timingTab)

    expect(screen.getAllByText(/Reloj de Prioridad por Jugador/i).length).toBeGreaterThanOrEqual(1)

    // Select 1 free mulligan (chip now shows just number)
    const mulliganChip = screen.getByText('1')
    fireEvent.click(mulliganChip)
    expect(mulliganChip.classList.contains('on')).toBe(true)
  })

  it('allows setting password and permissions in Security tab', async () => {
    render(<CreateTableDialog onClose={onClose} />)

    // Switch to Security tab
    const securityTab = screen.getByText(/🛡️/)
    fireEvent.click(securityTab)

    expect(screen.getByText(/Contraseña de la Mesa/i)).toBeDefined()
    expect(screen.getAllByText(/Permitir Espectadores|Allow Spectators/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Permitir Rebobinar|Allow Rollbacks/i).length).toBeGreaterThan(0)

    const passwordInput = screen.getByPlaceholderText(/Dejar en blanco para mesa pública|Leave blank for public table/i)
    fireEvent.change(passwordInput, { target: { value: 'secret123' } })
    expect((passwordInput as HTMLInputElement).value).toBe('secret123')
  })

  it('submits createTable with selected options and joins own seat', async () => {
    render(<CreateTableDialog onClose={onClose} />)

    // Fill table name
    const nameInput = screen.getByPlaceholderText(/Ej. Modern Casual Bo3/)
    fireEvent.change(nameInput, { target: { value: 'Epic Modern Duel' } })

    // Click submit button
    const submitBtn = screen.getByRole('button', { name: /Crear Mesa/ })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(cmds.createTable).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Epic Modern Duel',
          gameType: 'Two Player Duel',
          deckType: 'Constructed - Modern',
          winsNeeded: 1,
          skillLevel: 'CASUAL',
          spectatorsAllowed: true,
          rollbackTurnsAllowed: true,
        }),
      )
      expect(cmds.joinTable).toHaveBeenCalledWith(
        expect.objectContaining({
          tableId: 'table-123',
          playerType: 'HUMAN',
        }),
      )
      expect(onClose).toHaveBeenCalled()
    })
  })
})
