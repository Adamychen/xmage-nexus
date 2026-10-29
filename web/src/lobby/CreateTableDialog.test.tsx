import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import CreateTableDialog, { type CreateKind } from './CreateTableDialog'
import { STORAGE_KEY } from './CreateTable/constants'
import * as cmds from '../net/commands'
import { closeGallery, formatValue, galleryNames, openGallery, pickFormat } from './CreateTable/formatGalleryTestUtils'
import { setState } from '../state/state'

vi.mock('../net/commands', () => ({
  getGameTypes: vi.fn().mockResolvedValue([
    { name: 'Two Player Duel', minPlayers: 2, maxPlayers: 2 },
    { name: 'Commander Free For All', minPlayers: 3, maxPlayers: 10 },
  ]),
  getDeckTypes: vi.fn().mockResolvedValue(['Constructed - Modern', 'Constructed - Standard', 'Variant Magic - Commander', 'Limited']),
  getPlayerTypes: vi.fn().mockResolvedValue(['COMPUTER_MAD', 'COMPUTER_DRAFT']),
  getTournamentCatalogue: vi.fn().mockResolvedValue({
    names: [
      'Constructed Elimination',
      'Constructed Swiss',
      'Booster Draft Elimination',
      'Booster Draft Swiss',
      'Sealed Elimination',
      'Sealed Swiss',
    ],
    limits: {
      'Constructed Elimination': { minPlayers: 4, maxPlayers: 16 },
      'Constructed Swiss': { minPlayers: 4, maxPlayers: 16 },
      'Booster Draft Elimination': { minPlayers: 4, maxPlayers: 16 },
      'Booster Draft Swiss': { minPlayers: 4, maxPlayers: 16 },
      'Sealed Elimination': { minPlayers: 2, maxPlayers: 16 },
      'Sealed Swiss': { minPlayers: 2, maxPlayers: 16 },
    },
  }),
  getDraftCubes: vi.fn().mockResolvedValue([]),
  getExpansionsWithBoosters: vi.fn().mockResolvedValue([
    { code: 'MH3', name: 'Modern Horizons 3', releaseDate: 1718064000000 },
    { code: 'BLB', name: 'Bloomburrow', releaseDate: 1722556800000 },
    { code: 'M21', name: 'Core Set 2021', releaseDate: 1593734400000 },
  ]),
  createTable: vi.fn().mockResolvedValue({ ok: true, data: { tableId: 'table-123' } }),
  joinTable: vi.fn().mockResolvedValue({ ok: true }),
  removeTable: vi.fn().mockResolvedValue({ ok: true }),
  createTournamentTable: vi.fn().mockResolvedValue({ ok: true, data: { tableId: 'table-t1' } }),
  joinTournamentTable: vi.fn().mockResolvedValue({ ok: true }),
  validateDeck: vi.fn().mockResolvedValue({ ok: true }),
}))

/** Seats tab: pick a seat on the table (node 0 is my own seat), then a seat type from its editor. */
async function pickSeatType(node: number, name: RegExp) {
  fireEvent.click(await screen.findByTestId(`seat-node-${node}`))
  fireEvent.click(await screen.findByRole('radio', { name }))
}

/** Tournament Seats step: the Human or Bot radio of one seat row (row 0 is the host, which plays by default). */
function pickRowKind(row: number, name: RegExp) {
  fireEvent.click(within(screen.getAllByRole('listitem')[row]).getByRole('radio', { name }))
}

describe('CreateTableDialog', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
    localStorage?.removeItem(STORAGE_KEY)
    setState({ conn: null } as never)
  })

  // Renders the dialog and waits until the async form data (game/deck/player/
  // tournament types) has been applied. Without this the synchronous assertions
  // race the initial data load and fail on slower CI runners.
  /** Stepper button by its visible label (the step's `title`). */
  function goToStep(label: string) {
    const button = document.querySelector<HTMLButtonElement>(`button.wizard-step[title="${label}"]`)
    expect(button, `stepper button "${label}"`).not.toBeNull()
    fireEvent.click(button!)
  }

  async function renderDialog(kind: CreateKind = 'match') {
    const utils = render(<CreateTableDialog onClose={onClose} kind={kind} />)
    await waitFor(() => {
      if (kind === 'tourney') expect(screen.getByRole('radio', { name: /Draft de sobres/ })).toBeDefined()
      else expect(screen.getByTestId('format-game-type')).toBeDefined()
    }, { timeout: 5000, interval: 20 })
    return utils
  }

  it('renders modern create table dialog with navigation tabs', async () => {
    render(<CreateTableDialog onClose={onClose} />)

    expect(screen.getByRole('heading', { name: /Crear Mesa|Create Table/ })).toBeDefined()
    expect(screen.getAllByText(/General/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Tiempos & Reglas|Timers & Rules/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Restricciones|Restrictions/)).toBeDefined()
    expect(screen.getAllByText(/Multijugador|Multiplayer/).length).toBeGreaterThanOrEqual(1)
  })

  it('allows navigating to Timing tab and setting custom clocks and mulligans', async () => {
    render(<CreateTableDialog onClose={onClose} />)

    // Switch to Timing step (wizard is linear — clicking stepper jumps)
    const timingTab = screen.getAllByText(/Tiempos & Reglas|Timers & Rules/)[0]
    fireEvent.click(timingTab)

    expect(screen.getAllByText(/Reloj de Prioridad por Jugador/i).length).toBeGreaterThanOrEqual(1)

    // Select 1 free mulligan (chip now shows just number)
    const mulliganChip = screen.getByText('1')
    fireEvent.click(mulliganChip)
    expect(mulliganChip.getAttribute('aria-pressed')).toBe('true')
  })

  it('CR 103.5c: preselecciona 1 mulligan gratis en multijugador/Brawl y lo envía', async () => {
    const { container } = await renderDialog()
    const stepper = screen.getByRole('navigation', { name: /Pasos de creación|Creation steps/ })
    const goToStep = (i: number) => fireEvent.click(stepper.querySelectorAll('button')[i])
    const chips = () => Array.from(container.querySelectorAll('.chip-row .ui-chip')) as HTMLButtonElement[]
    const selectedChip = () => chips().find((c) => c.getAttribute('aria-pressed') === 'true')?.textContent
    const hint = () => screen.queryByText(/recomendado 1|recommended 1/)

    // Two Player Duel: sin mulligan gratis y sin recomendación
    goToStep(1)
    expect(selectedChip()).toBe('0')
    expect(hint()).toBeNull()

    // Commander Free For All: preset 1 + hint visible
    goToStep(0)
    await pickFormat('format-game-type', 'Commander Free For All')
    goToStep(1)
    expect(selectedChip()).toBe('1')
    expect(hint()).toBeDefined()

    // el override manual se respeta mientras no cambie el formato
    fireEvent.click(chips().find((c) => c.textContent === '3')!)
    expect(selectedChip()).toBe('3')

    // volver a 1v1 devuelve el default a 0
    goToStep(0)
    await pickFormat('format-game-type', 'Two Player Duel')
    goToStep(1)
    expect(selectedChip()).toBe('0')

    // y al crear una mesa multijugador se envía freeMulligans: 1
    goToStep(0)
    fireEvent.change(screen.getByPlaceholderText(/Ej. Modern Casual Bo3/), { target: { value: 'Commander Night' } })
    await pickFormat('format-game-type', 'Commander Free For All')
    for (let i = 0; i < 5; i++) {
      const nextBtn = screen.queryByRole('button', { name: /Siguiente/ })
      if (!nextBtn) break
      fireEvent.click(nextBtn)
    }
    fireEvent.click(screen.getByRole('button', { name: /Crear Mesa/ }))

    await waitFor(() => {
      expect(cmds.createTable).toHaveBeenCalledWith(
        expect.objectContaining({ gameType: 'Commander Free For All', freeMulligans: 1 }),
      )
    })
  })

  it('allows setting password and permissions in Security tab', async () => {
    render(<CreateTableDialog onClose={onClose} />)

    // Switch to Security tab
    const securityTab = screen.getByText(/Restricciones|Restrictions/)
    fireEvent.click(securityTab)

    expect(screen.getByText(/Contraseña de la Mesa/i)).toBeDefined()
    expect(screen.getAllByText(/Permitir Espectadores|Allow Spectators/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Permitir Rebobinar|Allow Rollbacks/i).length).toBeGreaterThan(0)

    const passwordInput = screen.getByPlaceholderText(/Dejar en blanco para mesa pública|Leave blank for public table/i)
    fireEvent.change(passwordInput, { target: { value: 'secret123' } })
    expect((passwordInput as HTMLInputElement).value).toBe('secret123')
  })

  it('LBY-3: keeps the table password working on beta.xmage.today (private tables on the public server)', async () => {
    setState({ conn: { serverHost: 'beta.xmage.today' } } as never)
    render(<CreateTableDialog onClose={onClose} />)

    fireEvent.change(screen.getByPlaceholderText(/Ej. Modern Casual Bo3/), { target: { value: 'Private Pod' } })
    fireEvent.click(screen.getByText(/Restricciones|Restrictions/))

    const passwordInput = screen.getByPlaceholderText(/Dejar en blanco para mesa pública|Leave blank for public table/i) as HTMLInputElement
    expect(passwordInput.disabled).toBe(false)
    fireEvent.change(passwordInput, { target: { value: 'secret123' } })

    for (let i = 0; i < 5; i++) {
      const nextBtn = screen.queryByRole('button', { name: /Siguiente/ })
      if (nextBtn) fireEvent.click(nextBtn)
    }
    fireEvent.click(screen.getByRole('button', { name: /Crear Mesa/ }))

    await waitFor(() => {
      expect(cmds.createTable).toHaveBeenCalledWith(expect.objectContaining({ password: 'secret123' }))
      expect(cmds.joinTable).toHaveBeenCalledWith(expect.objectContaining({ password: 'secret123' }))
    })
  })

  it('submits createTable with selected options and joins own seat', async () => {
    render(<CreateTableDialog onClose={onClose} />)

    // Fill table name (step 1 General)
    const nameInput = screen.getByPlaceholderText(/Ej. Modern Casual Bo3/)
    fireEvent.change(nameInput, { target: { value: 'Epic Modern Duel' } })

    // Wizard is linear — navigate to last step via Siguiente
    for (let i = 0; i < 5; i++) {
      const nextBtn = screen.queryByRole('button', { name: /Siguiente/ })
      if (nextBtn) fireEvent.click(nextBtn)
    }

    // Click submit button (only visible on last step)
    const submitBtn = screen.getByRole('button', { name: /Crear Mesa/ })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(cmds.createTable).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Epic Modern Duel',
          gameType: 'Two Player Duel',
          deckType: 'Limited',
          freeMulligans: 0,
          winsNeeded: 2,
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

  it('LBY-6: deletes the just-created table when joining the own seat fails, so retries leave no stray tables', async () => {
    vi.mocked(cmds.joinTable).mockResolvedValueOnce({ ok: false, error: 'Invalid deck' } as never)
    render(<CreateTableDialog onClose={onClose} />)
    fireEvent.change(screen.getByPlaceholderText(/Ej. Modern Casual Bo3/), { target: { value: 'Broken Deck Duel' } })
    for (let i = 0; i < 5; i++) {
      const nextBtn = screen.queryByRole('button', { name: /Siguiente/ })
      if (nextBtn) fireEvent.click(nextBtn)
    }
    fireEvent.click(screen.getByRole('button', { name: /Crear Mesa/ }))

    await waitFor(() => {
      expect(cmds.joinTable).toHaveBeenCalledWith(expect.objectContaining({ tableId: 'table-123' }))
      expect(cmds.removeTable).toHaveBeenCalledWith('table-123')
    })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('U2: blocks Siguiente on General with an empty name', async () => {
    render(<CreateTableDialog onClose={onClose} />)

    const nameInput = screen.getByPlaceholderText(/Ej. Modern Casual Bo3/)
    fireEvent.change(nameInput, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }))

    expect(screen.getByText(/necesita un nombre|needs a name/i)).toBeDefined()
    expect(screen.queryByText(/Mulligans Gratuitos|Free Mulligans/i)).toBeNull()
  })

  it('F7+F2: sends bannedUsers and per-seat skills on submit', async () => {
    render(<CreateTableDialog onClose={onClose} />)

    fireEvent.change(screen.getByPlaceholderText(/Ej. Modern Casual Bo3/), { target: { value: 'Skill Table' } })
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }))
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }))
    fireEvent.change(
      await screen.findByPlaceholderText(/separados por comas|comma-separated/i),
      { target: { value: 'griefer, troll' } },
    )
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }))
    // default extra seats wait for a human rival; opt into the Mad AI to get a bot seat with skill
    await pickSeatType(1, /IA Mad/)
    const seatSkill = await screen.findByTestId('seat-skill-0') as HTMLSelectElement
    fireEvent.change(seatSkill, { target: { value: '7' } })

    for (let i = 0; i < 5; i++) {
      const nextBtn = screen.queryByRole('button', { name: /Siguiente/ })
      if (!nextBtn) break
      fireEvent.click(nextBtn)
    }
    fireEvent.click(screen.getByRole('button', { name: /Crear Mesa/ }))

    await waitFor(() => {
      expect(cmds.createTable).toHaveBeenCalledWith(
        expect.objectContaining({
          bannedUsers: ['griefer', 'troll'],
          seatSkills: expect.arrayContaining([7]),
        }),
      )
      expect(cmds.joinTable).toHaveBeenCalledWith(expect.objectContaining({ skill: 2 }))
    })
  })

  it('LBY-5: an open seat waits for a human, with no bot and no SIM deck', async () => {
    render(<CreateTableDialog onClose={onClose} />)

    fireEvent.change(screen.getByPlaceholderText(/Ej. Modern Casual Bo3/), { target: { value: 'Humans Only' } })
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }))
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }))
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }))
    await pickSeatType(1, /Humano/)

    for (let i = 0; i < 5; i++) {
      const nextBtn = screen.queryByRole('button', { name: /Siguiente/ })
      if (!nextBtn) break
      fireEvent.click(nextBtn)
    }
    fireEvent.click(screen.getByRole('button', { name: /Crear Mesa/ }))

    await waitFor(() => {
      expect(cmds.createTable).toHaveBeenCalledWith(
        expect.objectContaining({
          playerTypes: ['HUMAN', 'HUMAN'],
        }),
      )
      const sent = (cmds.createTable as unknown as { mock: { calls: Array<[Record<string, unknown>]> } }).mock.calls[0][0]
      expect(sent.simDecks).toBeUndefined()
      expect(cmds.joinTable).toHaveBeenCalledWith(expect.objectContaining({ playerType: 'HUMAN' }))
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('TRN-1: a tournament opens on the Format step with three steps and no review', async () => {
    await renderDialog('tourney')
    expect(document.querySelectorAll('button.wizard-step')).toHaveLength(3)
    expect(screen.getByRole('radio', { name: /Draft de sobres/ }).getAttribute('aria-checked')).toBe('true')
    expect(screen.queryByRole('button', { name: /Revisar|Review/ })).toBeNull()
  })

  it('TRN-1: each tournament step has one primary action, Next until the last step, which creates the tournament', async () => {
    await renderDialog('tourney')
    expect(screen.getByRole('button', { name: /Siguiente/ })).toBeDefined()
    expect(screen.queryByRole('button', { name: /Crear torneo/ })).toBeNull()
    goToStep('Reglas')
    expect(screen.getByRole('button', { name: /Siguiente/ })).toBeDefined()
    expect(screen.queryByRole('button', { name: /Crear torneo/ })).toBeNull()
    goToStep('Plazas')
    expect(screen.queryByRole('button', { name: /Siguiente/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Crear torneo/ })).toBeDefined()
  })

  it('T2: draft tournament sends lobby flags (skill/rated/rollback/clocks/single)', async () => {
    render(<CreateTableDialog onClose={onClose} kind="tourney" />)

    fireEvent.change(screen.getByPlaceholderText(/Ej. Modern Casual Bo3/), { target: { value: 'Draft Night' } })
    fireEvent.click(screen.getByRole('button', { name: '4 plazas' }))
    goToStep('Reglas')
    fireEvent.click(screen.getByText(/Partida única en lugar de un match|Single game instead of a match/i))
    goToStep('Plazas')
    // Sin bots: todos los asientos en HUMANO (los bots no entregan el mazo construido)
    pickRowKind(1, /Humano/)
    fireEvent.click(screen.getByRole('button', { name: /Crear torneo/i }))

    await waitFor(() => {
      expect(cmds.createTournamentTable).toHaveBeenCalledWith(
        expect.objectContaining({
          tournamentType: 'Booster Draft Elimination',
          deckType: 'Limited',
          skillLevel: 'CASUAL',
          rated: false,
          rollbackTurnsAllowed: true,
          timeLimit: 'MIN__25',
          isSingleMultiplayerGame: true,
          playerTypes: ['HUMAN', 'HUMAN', 'HUMAN', 'HUMAN'],
        }),
      )
      const sent = (cmds.createTournamentTable as unknown as { mock: { calls: Array<[Record<string, unknown>]> } }).mock.calls[0][0]
      expect(sent.bufferTime).toBeUndefined()
      expect(sent.bannedUsers).toBeUndefined()
      expect(sent.minimumRating).toBeUndefined()
      expect(cmds.joinTournamentTable).toHaveBeenCalledWith(expect.objectContaining({ tableId: 'table-t1' }))
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('T6: draft tournament sends timing only for Draft types', async () => {
    await renderDialog('tourney')

    fireEvent.change(screen.getByPlaceholderText(/Ej. Modern Casual Bo3/), { target: { value: 'Timed Draft' } })
    fireEvent.click(screen.getByRole('radio', { name: /Sellado/ }))
    // timing selector hidden for non-draft types
    goToStep('Reglas')
    expect(screen.queryByText(/Draft pick time|Tiempo por pick/i)).toBeNull()
    goToStep('Formato')
    fireEvent.click(screen.getByRole('radio', { name: /Draft de sobres/ }))
    goToStep('Reglas')
    const timingSelect = await screen.findByLabelText(/Draft pick time|Tiempo por pick/i) as HTMLSelectElement
    expect(timingSelect.value).toBe('REGULAR')
    fireEvent.change(timingSelect, { target: { value: 'PROFESSIONAL' } })
    // Sin bots: todos los asientos en HUMANO (los bots no entregan el mazo construido)
    goToStep('Plazas')
    pickRowKind(1, /Humano/)
    fireEvent.click(screen.getByRole('button', { name: /Crear torneo/i }))

    await waitFor(() => {
      const sent = (cmds.createTournamentTable as unknown as { mock: { calls: Array<[Record<string, unknown>]> } }).mock.calls[0][0]
      expect((sent.limitedOptions as Record<string, unknown>).timing).toBe('PROFESSIONAL')
    })
  })

  it('T7: the game type and format fields configure the table', async () => {
    render(<CreateTableDialog onClose={onClose} />)

    await pickFormat('format-game-type', 'Commander Free For All')
    expect(formatValue('format-game-type')).toBe('Commander Free For All')
    expect(formatValue('format-deck-type')).toBe('Variant Magic - Commander')

    await pickFormat('format-game-type', 'Two Player Duel')
    expect(formatValue('format-game-type')).toBe('Two Player Duel')

    expect(screen.queryByRole('button', { name: /Modern (Suizo|Swiss) \((8J|8P)\)/i })).toBeNull()
  })

  it('T7b: el preset Modern Swiss vive en el torneo y configura un torneo construido', () => {
    render(<CreateTableDialog onClose={onClose} kind="tourney" />)
    fireEvent.click(screen.getByRole('button', { name: /Modern (Suizo|Swiss) \((8J|8P)\)/i }))
    expect(screen.getByRole('radio', { name: /^Construido/i }).getAttribute('aria-checked')).toBe('true')
  })

  it('T8: constructed tournament creates tournament table with constructed format and joins with deck', async () => {
    render(<CreateTableDialog onClose={onClose} kind="tourney" />)

    fireEvent.change(screen.getByPlaceholderText(/Ej. Modern Casual Bo3/), { target: { value: 'Modern Swiss 8P' } })
    // Click Modern Swiss (8P) preset
    fireEvent.click(screen.getByRole('button', { name: /Modern (Suizo|Swiss) \((8J|8P)\)/i }))

    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }))
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }))

    fireEvent.click(screen.getByRole('button', { name: /Crear torneo/i }))

    await waitFor(() => {
      expect(cmds.createTournamentTable).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Modern Swiss 8P',
          tournamentType: 'Constructed Swiss',
          deckType: 'Constructed - Modern',
          limited: false,
          winsNeeded: 2,
          numberRounds: 3,
        }),
      )
      expect(cmds.joinTournamentTable).toHaveBeenCalledWith(
        expect.objectContaining({
          tableId: 'table-t1',
          playerType: 'HUMAN',
          deckType: 'Constructed - Modern',
        }),
      )
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('T9: handles server returning TournamentTypeView objects without throwing t.startsWith is not a function', async () => {
    // The catalogue carries the names of TournamentTypeView objects, not plain strings
    vi.mocked(cmds.getTournamentCatalogue).mockResolvedValueOnce({
      names: ['Constructed Elimination', 'Constructed Swiss', 'Booster Draft'],
      limits: {
        'Constructed Elimination': { minPlayers: 2, maxPlayers: 16 },
        'Constructed Swiss': { minPlayers: 2, maxPlayers: 16 },
        'Booster Draft': { minPlayers: 4, maxPlayers: 8 },
      },
    })

    render(<CreateTableDialog onClose={onClose} kind="tourney" />)

    // Wait for the async effect to resolve the tournament catalogue
    await waitFor(() => {
      expect(cmds.getTournamentCatalogue).toHaveBeenCalled()
    })

    // The tournament entry point renders the modality and pairing cards directly
    expect(screen.getByRole('radio', { name: /Draft de sobres/ })).toBeDefined()
    expect(screen.getByRole('radio', { name: /^Construido/ })).toBeDefined()
  })

  it('T10: links gameType and deckType to prevent incompatible combinations', async () => {
    render(<CreateTableDialog onClose={onClose} />)

    // Initial state: Two Player Duel -> Limited (official client default)
    expect(formatValue('format-game-type')).toBe('Two Player Duel')
    expect(formatValue('format-deck-type')).toBe('Limited')
    // Format options should NOT include Commander
    await openGallery('format-deck-type')
    const initialOptions = galleryNames()
    expect(initialOptions).toContain('Constructed - Modern')
    expect(initialOptions).toContain('Constructed - Standard')
    expect(initialOptions).not.toContain('Variant Magic - Commander')
    closeGallery()

    // Change gameType to Commander Free For All
    await pickFormat('format-game-type', 'Commander Free For All')
    expect(formatValue('format-deck-type')).toBe('Variant Magic - Commander')

    // Format options should now ONLY include Commander formats
    await openGallery('format-deck-type')
    const commanderOptions = galleryNames()
    expect(commanderOptions).toContain('Variant Magic - Commander')
    expect(commanderOptions).not.toContain('Constructed - Modern')
    expect(commanderOptions).not.toContain('Constructed - Standard')
    closeGallery()

    // Switch back to Two Player Duel
    await pickFormat('format-game-type', 'Two Player Duel')
    expect(formatValue('format-deck-type')).toBe('Constructed - Modern')
    await openGallery('format-deck-type')
    const duelOptions = galleryNames()
    expect(duelOptions).toContain('Constructed - Modern')
    expect(duelOptions).not.toContain('Variant Magic - Commander')
    closeGallery()
  })

  it('T11: the match step shows the game type and format fields instead of format cards', () => {
    const { container } = render(<CreateTableDialog onClose={onClose} />)
    expect(screen.getByTestId('format-game-type')).toBeDefined()
    expect(screen.getByTestId('format-deck-type')).toBeDefined()
    expect(container.querySelectorAll('.format-card').length).toBe(0)
  })

  it('T12: the set slots fill from a popular chip and each booster can still be changed on its own', async () => {
    render(<CreateTableDialog onClose={onClose} kind="tourney" />)

    // Popular chips should be visible
    expect(screen.getByRole('button', { name: 'MH3' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'BLB' })).toBeDefined()

    // Clicking MH3 chip sets all boosters
    fireEvent.click(screen.getByRole('button', { name: 'MH3' }))
    fireEvent.click(screen.getByRole('button', { name: 'Escribir códigos…' }))
    const setsInput = screen.getByPlaceholderText(/Ej. M21, MH3, BLB/) as HTMLInputElement
    expect(setsInput.value).toBe('MH3, MH3, MH3')

    // Each booster has its own slot
    expect(screen.getByLabelText(/^Sobre 1/)).toBeDefined()
    expect(screen.getByLabelText(/^Sobre 2/)).toBeDefined()
    expect(screen.getByLabelText(/^Sobre 3/)).toBeDefined()
  })

  // Issue #12: "I selected a default starter deck and then could not change my
  // deck from that same screen". The deck <select> does re-enable once
  // `adoptStarterDecks` populates the list, so what was missing was a way to
  // EDIT the deck's contents without creating the table.
  it('opens the deck builder for the selected deck and leaves the wizard', async () => {
    const onEditDeck = vi.fn()
    render(<CreateTableDialog onClose={onClose} onEditDeck={onEditDeck} />)
    await waitFor(() => {
      expect(screen.getByTestId('format-game-type')).toBeDefined()
    }, { timeout: 5000, interval: 20 })

    const stepper = screen.getByRole('navigation', { name: /Pasos de creación|Creation steps/ })
    fireEvent.click(stepper.querySelectorAll('button')[3])

    const editBtn = await screen.findByTestId('create-edit-deck')
    await waitFor(() => expect((editBtn as HTMLButtonElement).disabled).toBe(false))

    fireEvent.click(editBtn)

    expect(onEditDeck).toHaveBeenCalledTimes(1)
    expect(typeof onEditDeck.mock.calls[0][0]).toBe('string')
    expect(onEditDeck.mock.calls[0][0]).not.toBe('')
    // The wizard closes instead of staying mounted behind: `Modal` traps Tab on
    // `document` in the capture phase and only defers to another Modal with a
    // higher z, and `DeckBuilder` is not a Modal — a hidden wizard would keep
    // the focus. Losing the form is the cost of not fighting focus.
    expect(onClose).toHaveBeenCalled()
  })

  it('disables the edit action when the host cannot open the builder', async () => {
    // Without `onEditDeck` (the gallery mounts the dialog that way) the button
    // must not be enabled: it used to be clickable and did nothing.
    render(<CreateTableDialog onClose={onClose} />)
    await waitFor(() => {
      expect(screen.getByTestId('format-game-type')).toBeDefined()
    }, { timeout: 5000, interval: 20 })

    const stepper = screen.getByRole('navigation', { name: /Pasos de creación|Creation steps/ })
    fireEvent.click(stepper.querySelectorAll('button')[3])

    const editBtn = await screen.findByTestId('create-edit-deck')
    await waitFor(() => expect((editBtn as HTMLButtonElement).disabled).toBe(true))
  })

  it('LBY-5: creates a table with COMPUTER_MAD and joins both the bot and the human player', async () => {
    await renderDialog()

    const nameInput = screen.getByPlaceholderText(/Ej. Modern Casual Bo3/)
    fireEvent.change(nameInput, { target: { value: 'Mad Bot Duel' } })

    // Navigate to Plazas/Seats tab (step 4)
    for (let i = 0; i < 3; i++) {
      const nextBtn = screen.queryByRole('button', { name: /Siguiente/ })
      if (nextBtn) fireEvent.click(nextBtn)
    }

    // Set seat 2 (the first opponent seat, node 1 after my own) to the Mad AI
    await pickSeatType(1, /IA Mad/)
    expect(screen.getByRole('radio', { name: /IA Mad/ }).getAttribute('aria-checked')).toBe('true')

    // Navigate to Summary / last step
    const nextBtn = screen.queryByRole('button', { name: /Siguiente/ })
    if (nextBtn) fireEvent.click(nextBtn)

    // Submit
    const submitBtn = await screen.findByRole('button', { name: /Crear Mesa/ })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(cmds.createTable).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Mad Bot Duel',
          playerTypes: ['HUMAN', 'COMPUTER_MAD'],
        }),
      )
      expect(cmds.joinTable).toHaveBeenCalledWith(
        expect.objectContaining({
          tableId: 'table-123',
          playerType: 'COMPUTER_MAD',
          playerName: 'Computer',
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

  it('LM1: match Limited muestra resumen honesto y no ofrece draft', async () => {
    const { container } = await renderDialog()
    const reviewText = () => container.querySelector('.create-review')?.textContent ?? ''

    await pickFormat('format-deck-type', 'Limited')
    expect(await screen.findByText(/no genera sobres/)).toBeDefined()
    expect(screen.queryByPlaceholderText(/Ej\. M21, MH3, BLB/)).toBeNull()
    expect(screen.queryByText(/Crear como torneo Draft/i)).toBeNull()
    goToStep('Revisar')
    expect(reviewText()).toMatch(/mazos de 40\+/)
  })

  it('T14: el wizard abre con el set repetido por sobre y lo sincroniza al cambiar de sobres', async () => {
    await renderDialog('tourney')
    fireEvent.click(screen.getByRole('button', { name: 'Escribir códigos…' }))
    const setsInput = await screen.findByPlaceholderText(/Ej\. M21, MH3, BLB/) as HTMLInputElement
    expect(setsInput.value).toBe('M21, M21, M21')
    fireEvent.click(screen.getByRole('tab', { name: '6' }))
    expect(setsInput.value).toBe('M21, M21, M21, M21, M21, M21')
    fireEvent.change(setsInput, { target: { value: 'M21, MH3, DSK' } })
    fireEvent.click(screen.getByRole('tab', { name: '3' }))
    expect(setsInput.value).toBe('M21, MH3, DSK')
  })

  it('TRN-6: a limited tournament cannot seat a bot: the Bot choice is disabled with the reason, so every seat is human', async () => {
    render(<CreateTableDialog onClose={onClose} kind="tourney" />)
    fireEvent.change(screen.getByPlaceholderText(/Ej. Modern Casual Bo3/), { target: { value: 'Draft con bots' } })

    goToStep('Plazas')
    expect((within(screen.getAllByRole('listitem')[1]).getByRole('radio', { name: /^IA$/ }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/nunca llegaría a sus rondas/)).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /Crear torneo|Create Draft/i }))

    await waitFor(() => {
      const sent = (cmds.createTournamentTable as unknown as { mock: { calls: Array<[Record<string, unknown>]> } }).mock.calls[0][0]
      expect(sent.playerTypes).toEqual(Array(8).fill('HUMAN'))
    })
  })

  it('TRN-5: a limited tournament joins its host without a deck', async () => {
    render(<CreateTableDialog onClose={onClose} kind="tourney" />)
    fireEvent.change(screen.getByPlaceholderText(/Ej. Modern Casual Bo3/), { target: { value: 'Sealed Night' } })
    fireEvent.click(screen.getByRole('radio', { name: /Sellado/ }))
    fireEvent.click(screen.getByRole('button', { name: '4 plazas' }))
    goToStep('Plazas')
    expect(screen.getByText(/En limitado nadie trae mazo/)).toBeDefined()
    expect(screen.queryByTestId('create-edit-deck')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Crear torneo/i }))

    await waitFor(() => {
      expect(cmds.joinTournamentTable).toHaveBeenCalledWith(expect.objectContaining({ tableId: 'table-t1', playerType: 'HUMAN' }))
    })
    const hostJoin = vi.mocked(cmds.joinTournamentTable).mock.calls.find(([a]) => a.playerType === 'HUMAN')?.[0] as Record<string, unknown>
    expect(hostJoin).not.toHaveProperty('deck')
    expect(hostJoin).not.toHaveProperty('deckType')
  })

  it('TRN-6: a constructed tournament with bots turns them into open human seats when it becomes limited', async () => {
    render(<CreateTableDialog onClose={onClose} kind="tourney" />)
    fireEvent.click(screen.getByRole('radio', { name: /^Construido/ }))
    goToStep('Plazas')
    pickRowKind(1, /^IA$/)
    expect(screen.getByTestId('seat-type-0')).toBeDefined()

    goToStep('Formato')
    fireEvent.click(screen.getByRole('radio', { name: /Draft de sobres/ }))
    goToStep('Plazas')
    expect(within(screen.getAllByRole('listitem')[1]).getByRole('radio', { name: /^Humano$/ }).getAttribute('aria-checked')).toBe('true')
    expect(screen.queryByTestId('seat-type-0')).toBeNull()
  })

  it('el stepper no salta al último paso con el nombre vacío (AUDIT)', async () => {
    render(<CreateTableDialog onClose={onClose} />)
    fireEvent.change(screen.getByPlaceholderText(/Ej. Modern Casual Bo3/), { target: { value: '   ' } })
    const stepper = screen.getByRole('navigation', { name: /Pasos de creación|Creation steps/ })
    const steps = stepper.querySelectorAll('button')
    fireEvent.click(steps[steps.length - 1])
    await waitFor(() => {
      expect(screen.getByText(/necesita un nombre|needs a name/i)).toBeDefined()
    })
    expect((screen.getByRole('button', { name: /Crear mesa|Create table/i }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('marks the General step has-error and shows the reason when the name is cleared on the last step', async () => {
    render(<CreateTableDialog onClose={onClose} />)
    for (let i = 0; i < 6; i++) {
      const nextBtn = screen.queryByRole('button', { name: /Siguiente|Next/ })
      if (!nextBtn) break
      fireEvent.click(nextBtn)
    }
    const stepper = screen.getByRole('navigation', { name: /Pasos de creación|Creation steps/ })
    fireEvent.click(stepper.querySelectorAll('button')[0])
    fireEvent.change(screen.getByPlaceholderText(/Ej. Modern Casual Bo3/), { target: { value: '' } })

    expect(stepper.querySelectorAll('button')[0].classList.contains('has-error')).toBe(true)
    expect(stepper.querySelectorAll('button')[0].getAttribute('aria-label')).toMatch(/necesita un nombre|needs a name/i)
    expect(screen.getByText(/necesita un nombre|needs a name/i).closest('.error-box')).not.toBeNull()
    expect((screen.getByRole('button', { name: /Crear mesa|Create table/i }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('Reset to defaults restores a fresh form and clears the saved key', async () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v) },
      removeItem: vi.fn((k: string) => { store.delete(k) }),
    })
    await renderDialog()
    fireEvent.change(screen.getByPlaceholderText(/Ej. Modern Casual Bo3/), { target: { value: 'Mi mesa' } })
    await waitFor(() => expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').name).toBe('Mi mesa'))

    fireEvent.click(screen.getByRole('button', { name: /Restablecer valores|Reset to defaults/ }))

    expect(vi.mocked(localStorage.removeItem)).toHaveBeenCalledWith(STORAGE_KEY)
    await waitFor(() => expect((screen.getByPlaceholderText(/Ej. Modern Casual Bo3/) as HTMLInputElement).value).toBe('Game'))
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').name).toBe('Game')
    vi.unstubAllGlobals()
  })
})

describe('CreateTableDialog: tournament summary and rules', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
    localStorage?.removeItem(STORAGE_KEY)
    setState({ conn: null } as never)
  })

  async function openTourney() {
    render(<CreateTableDialog onClose={onClose} kind="tourney" />)
    await waitFor(() => expect(screen.getByRole('radio', { name: /Draft de sobres/ })).toBeDefined(), { timeout: 5000, interval: 20 })
  }

  function goToStep(label: string) {
    const button = document.querySelector<HTMLButtonElement>(`button.wizard-step[title="${label}"]`)
    expect(button, `stepper button "${label}"`).not.toBeNull()
    fireEvent.click(button!)
  }

  const summary = () => screen.getByTestId('trn-summary')
  const summaryPhases = () => Array.from(summary().querySelectorAll('.trn-summary-phases li')).map((li) => li.textContent ?? '')
  const summaryFact = (label: string) => {
    const term = Array.from(summary().querySelectorAll('.trn-summary-fact dt')).find((dt) => dt.textContent === label)
    return term?.nextElementSibling?.textContent ?? null
  }
  const panelTitles = () => Array.from(document.querySelectorAll('.trn-panel-title')).map((h) => h.textContent)
  const advanced = () => document.querySelector<HTMLDetailsElement>('details.trn-advanced')!
  const sentArgs = () => vi.mocked(cmds.createTournamentTable).mock.calls[0][0] as Record<string, unknown>

  it('TRN-1: the summary sits beside the steps on every step, with the name, the format and the phases of a draft', async () => {
    await openTourney()
    fireEvent.change(screen.getByPlaceholderText(/Ej. Modern Casual Bo3/), { target: { value: 'Draft Night' } })
    for (const step of ['Formato', 'Reglas', 'Plazas']) {
      goToStep(step)
      expect(summary().querySelector('.trn-summary-name')?.textContent).toBe('Draft Night')
    }
    goToStep('Formato')
    expect(summary().querySelector('.trn-summary-format')?.textContent).toBe('Draft de sobres · Eliminación')
    expect(summaryPhases()).toEqual([
      'Draft: 3 sobres · M21 ×3 · Picks normales',
      'Construcción · 10 minutos',
      'Cuartos de final → Semifinales → Gran final · Bo3',
      'Campeón',
    ])
    expect(summaryFact('Plazas')).toBe('8 · tú + 7 libres')
    expect(summaryFact('Reloj por jugador')).toBe('25 minutos')
    expect(summaryFact('Acceso')).toBe('Abierto · con espectadores')
    expect(summaryFact('Puntuable')).toBe('No')
  })

  it('TRN-1: changing the modality, pairing, seats and Bo changes the phases and the facts live', async () => {
    await openTourney()
    fireEvent.click(screen.getByRole('radio', { name: /^Construido/ }))
    expect(summaryPhases()[0]).toBe('Inscripción · cada jugador se une con su mazo Constructed - Modern')
    expect(summaryPhases().some((p) => p.startsWith('Construcción'))).toBe(false)

    fireEvent.click(screen.getByRole('radio', { name: /^Suizo/ }))
    fireEvent.click(screen.getByRole('button', { name: '4 plazas' }))
    expect(summaryFact('Plazas')).toBe('4 · tú + 3 libres')
    expect(summaryPhases()).toContain('2 rondas suizas · Bo3')
    expect(summaryPhases()).toContain('Clasificación final por puntos (3/1/0)')

    goToStep('Reglas')
    fireEvent.click(screen.getByRole('tab', { name: 'Bo5' }))
    expect(summaryPhases()).toContain('2 rondas suizas · Bo5')
    expect(summary().querySelector('.trn-summary-line')?.textContent).toContain('Bo5')
  })

  it('TRN-1: the status line says the tournament is ready, or names the first blocking step', async () => {
    await openTourney()
    expect(summary().querySelector('.trn-summary-status.is-ready')?.textContent).toMatch(/Listo para crear/)
    fireEvent.change(screen.getByPlaceholderText(/Ej. Modern Casual Bo3/), { target: { value: '   ' } })
    const blocked = summary().querySelector('.trn-summary-status.is-blocked')
    expect(blocked?.textContent).toMatch(/necesita un nombre|needs a name/i)
    expect(summary().querySelector('.trn-summary-status.is-ready')).toBeNull()
  })

  it('TRN-1: on a phone the summary is one line that expands to the full summary', async () => {
    await openTourney()
    const toggle = summary().querySelector<HTMLButtonElement>('.trn-summary-toggle')!
    const body = document.getElementById(toggle.getAttribute('aria-controls') ?? '')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(toggle.textContent).toContain('Bo3')
    expect(toggle.textContent).toContain('8 plazas')
    expect(body).not.toBeNull()
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(summary().classList.contains('is-open')).toBe(true)
  })

  it('TRN-8: the rules step groups its fields in Matches, Draft and construction, and Access, with Advanced folded', async () => {
    await openTourney()
    goToStep('Reglas')
    expect(panelTitles()).toEqual(['Partidas', 'Draft y construcción', 'Acceso'])
    expect(advanced().open).toBe(false)
    expect(advanced().querySelector('summary')?.textContent).toContain('Avanzado')
  })

  it('TRN-8: the draft and construction group is limited only: a constructed tournament has none', async () => {
    await openTourney()
    fireEvent.click(screen.getByRole('radio', { name: /^Construido/ }))
    goToStep('Reglas')
    expect(panelTitles()).toEqual(['Partidas', 'Acceso'])
    expect(screen.queryByLabelText(/Tiempo de construcción/)).toBeNull()
  })

  it('TRN-8: the game type sits in Advanced for a constructed tournament, and is not offered for a limited one', async () => {
    await openTourney()
    goToStep('Reglas')
    expect(screen.queryByTestId('format-game-type')).toBeNull()
    goToStep('Formato')
    fireEvent.click(screen.getByRole('radio', { name: /^Construido/ }))
    goToStep('Reglas')
    expect(advanced().querySelector('[data-testid="format-game-type"]')).not.toBeNull()
  })

  it('TRN-8: every field of the rules step is sent to createTournamentTable with the value the player chose', async () => {
    await openTourney()
    fireEvent.change(screen.getByPlaceholderText(/Ej. Modern Casual Bo3/), { target: { value: 'Every Rule' } })
    goToStep('Reglas')

    fireEvent.click(screen.getByRole('tab', { name: 'Bo5' }))
    fireEvent.change(screen.getByLabelText(/Reloj de Prioridad por Jugador/), { target: { value: 'MIN__30' } })
    fireEvent.change(screen.getByLabelText(/Buffer de tiempo/), { target: { value: 'SEC__10' } })
    fireEvent.change(screen.getByLabelText(/Tiempo de construcción/), { target: { value: '1500' } })
    fireEvent.change(screen.getByLabelText(/Tiempo por pick del draft/), { target: { value: 'PROFESSIONAL' } })
    fireEvent.click(screen.getByText(/Partida única en lugar de un match/))

    fireEvent.change(screen.getByLabelText(/Contraseña de la Mesa/), { target: { value: 'secreto' } })
    fireEvent.change(screen.getByLabelText(/Rating mínimo/), { target: { value: '1200' } })
    fireEvent.change(screen.getByLabelText(/Abandonos máximos permitidos/), { target: { value: '50' } })
    fireEvent.click(screen.getByRole('button', { name: /Competitivo/ }))
    fireEvent.click(screen.getByText(/Partida Puntuada/))
    fireEvent.click(screen.getByText(/Permitir Espectadores/))
    fireEvent.change(screen.getByLabelText(/Usuarios vetados/), { target: { value: 'bob, ana' } })

    advanced().open = true
    fireEvent.click(screen.getByText(/Permitir Rebobinar/))

    goToStep('Plazas')
    fireEvent.click(screen.getByRole('button', { name: /Crear torneo/i }))

    await waitFor(() => expect(cmds.createTournamentTable).toHaveBeenCalled())
    expect(sentArgs()).toMatchObject({
      name: 'Every Rule',
      winsNeeded: 3,
      timeLimit: 'MIN__30',
      bufferTime: 'SEC__10',
      limited: true,
      limitedOptions: expect.objectContaining({ constructionTime: 1500, timing: 'PROFESSIONAL' }),
      isSingleMultiplayerGame: true,
      password: 'secreto',
      minimumRating: 1200,
      quitRatio: 50,
      skillLevel: 'SERIOUS',
      rated: true,
      spectatorsAllowed: false,
      watchingAllowed: false,
      bannedUsers: ['bob', 'ana'],
      rollbackTurnsAllowed: false,
    })
    expect(cmds.joinTournamentTable).toHaveBeenCalledWith(expect.objectContaining({ tableId: 'table-t1', password: 'secreto' }))
  })

  it('TRN-8: the options only a match applies (free mulligans, mulligan type, starting life and hand, Planechase, attack and range, EDH power) are not offered for a tournament', async () => {
    await openTourney()
    goToStep('Reglas')
    for (const label of [/Mulligans Gratuitos/, /Tipo de Mulligan/, /Vida inicial personalizada/, /Mano inicial personalizada/, /Planechase/, /Opción de Ataque/, /Rango de Influencia/, /Potencia EDH/]) {
      expect(screen.queryAllByText(label), String(label)).toHaveLength(0)
    }
    expect(document.querySelector('.custom-options')).toBeNull()
  })

  it('TRN-8: the same options are offered for a match, which still applies them', async () => {
    render(<CreateTableDialog onClose={onClose} />)
    await pickFormat('format-game-type', 'Commander Free For All')
    goToStep('Tiempos & Reglas')
    expect(screen.queryAllByText(/Mulligans Gratuitos/).length).toBeGreaterThan(0)
    expect(screen.queryAllByText(/Tipo de Mulligan/).length).toBeGreaterThan(0)
    expect(screen.queryAllByText(/Rango de Influencia/).length).toBeGreaterThan(0)
    goToStep('Restricciones')
    expect(screen.queryAllByText(/Potencia EDH/).length).toBeGreaterThan(0)
  })

  it('TRN-8: a constructed tournament sends the game type shown in Advanced and its rounds', async () => {
    await openTourney()
    fireEvent.change(screen.getByPlaceholderText(/Ej. Modern Casual Bo3/), { target: { value: 'Modern Advanced' } })
    fireEvent.click(screen.getByRole('button', { name: /Modern (Suizo|Swiss) \((8J|8P)\)/i }))
    goToStep('Reglas')
    advanced().open = true
    await pickFormat('format-game-type', 'Commander Free For All')
    goToStep('Plazas')
    fireEvent.click(screen.getByRole('button', { name: /Crear torneo/i }))

    await waitFor(() => expect(cmds.createTournamentTable).toHaveBeenCalled())
    expect(sentArgs()).toMatchObject({
      tournamentType: 'Constructed Swiss',
      gameType: 'Commander Free For All',
      numberRounds: 3,
    })
  })
})
