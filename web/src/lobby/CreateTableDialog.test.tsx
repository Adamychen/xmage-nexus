import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
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
  getTournamentTypes: vi.fn().mockResolvedValue([
    'Constructed Elimination',
    'Constructed Swiss',
    'Booster Draft Elimination',
    'Booster Draft Swiss',
    'Sealed Elimination',
    'Sealed Swiss',
  ]),
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
      expect(screen.getByTestId('format-game-type')).toBeDefined()
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

  it('mantiene la contraseña operativa en beta.xmage.today (mesas privadas del servidor público)', async () => {
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

  it('deletes the just-created table when joining the own seat fails, so retries leave no stray tables', async () => {
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

  it('HUMAN: plaza en espera para humanos, sin bot ni mazo SIM', async () => {
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

  it('U8: draft tournament exposes number of rounds', async () => {
    render(<CreateTableDialog onClose={onClose} kind="tourney" />)

    const typeSelect = screen.getAllByRole('combobox')[0] as HTMLSelectElement
    fireEvent.change(typeSelect, { target: { value: 'Booster Draft Swiss' } })
    const rounds = screen.getByLabelText(/rondas|rounds/i) as HTMLInputElement
    fireEvent.change(rounds, { target: { value: '5' } })
    expect(rounds.value).toBe('5')
  })

  it('T3: number of rounds only shows for Swiss tournament types', async () => {
    await renderDialog('tourney')

    // default is now a valid server draft type → rounds hidden
    const typeSelect = screen.getAllByRole('combobox')[0] as HTMLSelectElement
    expect(typeSelect.value).toBe('Booster Draft Elimination')
    expect(screen.queryByLabelText(/rondas|rounds/i)).toBeNull()
    fireEvent.change(typeSelect, { target: { value: 'Booster Draft Swiss' } })
    expect(screen.getByLabelText(/rondas|rounds/i)).toBeDefined()
    fireEvent.change(typeSelect, { target: { value: 'Sealed Elimination' } })
    expect(screen.queryByLabelText(/rondas|rounds/i)).toBeNull()
    // draft pick time is a Draft-step setting: only for a Draft type
    fireEvent.change(typeSelect, { target: { value: 'Booster Draft Elimination' } })
    goToStep('Draft')
    expect(await screen.findByLabelText(/Draft pick time|Tiempo por pick/i)).toBeDefined()
  })

  it('T2: draft tournament sends lobby flags (skill/rated/rollback/clocks/single)', async () => {
    render(<CreateTableDialog onClose={onClose} kind="tourney" />)

    fireEvent.change(screen.getByPlaceholderText(/Ej. Modern Casual Bo3/), { target: { value: 'Draft Night' } })
    goToStep('Draft')
    fireEvent.click(screen.getByText(/Jugar como partida única|Play as single game/i))
    // Sin bots: todos los asientos en HUMANO (los bots no entregan el mazo construido)
    fireEvent.click(
      screen
        .getAllByRole('button', { name: /Multijugador/ })
        .find((b) => (b as HTMLElement).classList.contains('wizard-step'))!,
    )
    await pickSeatType(1, /Humano/)

    for (let i = 0; i < 6; i++) {
      const nextBtn = screen.queryByRole('button', { name: /Siguiente/ })
      if (!nextBtn) break
      fireEvent.click(nextBtn)
    }
    fireEvent.click(screen.getByRole('button', { name: /Crear torneo|Create Draft/i }))

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
          playerTypes: ['HUMAN', 'HUMAN'],
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
    const typeSelect = screen.getAllByRole('combobox')[0] as HTMLSelectElement
    fireEvent.change(typeSelect, { target: { value: 'Sealed Swiss' } })
    // timing selector hidden for non-draft types
    expect(screen.queryByText(/Draft pick time|Tiempo por pick/i)).toBeNull()
    fireEvent.change(typeSelect, { target: { value: 'Booster Draft Elimination' } })
    goToStep('Draft')
    const timingSelect = await screen.findByLabelText(/Draft pick time|Tiempo por pick/i) as HTMLSelectElement
    expect(timingSelect.value).toBe('REGULAR')
    fireEvent.change(timingSelect, { target: { value: 'PROFESSIONAL' } })
    // Sin bots: todos los asientos en HUMANO (los bots no entregan el mazo construido)
    fireEvent.click(
      screen
        .getAllByRole('button', { name: /Multijugador/ })
        .find((b) => (b as HTMLElement).classList.contains('wizard-step'))!,
    )
    await pickSeatType(1, /Humano/)

    for (let i = 0; i < 6; i++) {
      const nextBtn = screen.queryByRole('button', { name: /Siguiente/ })
      if (!nextBtn) break
      fireEvent.click(nextBtn)
    }
    fireEvent.click(screen.getByRole('button', { name: /Crear torneo|Create Draft/i }))

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
    expect(screen.getByRole('tab', { name: /^Construido/i }).getAttribute('aria-selected')).toBe('true')
  })

  it('T8: constructed tournament creates tournament table with constructed format and joins with deck', async () => {
    render(<CreateTableDialog onClose={onClose} kind="tourney" />)

    fireEvent.change(screen.getByPlaceholderText(/Ej. Modern Casual Bo3/), { target: { value: 'Modern Swiss 8P' } })
    // Click Modern Swiss (8P) preset
    fireEvent.click(screen.getByRole('button', { name: /Modern (Suizo|Swiss) \((8J|8P)\)/i }))

    for (let i = 0; i < 6; i++) {
      const nextBtn = screen.queryByRole('button', { name: /Siguiente/ })
      if (!nextBtn) break
      fireEvent.click(nextBtn)
    }

    fireEvent.click(screen.getByRole('button', { name: /Crear torneo/i }))

    await waitFor(() => {
      expect(cmds.createTournamentTable).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Modern Swiss 8P',
          tournamentType: 'Constructed Swiss',
          deckType: 'Constructed - Modern',
          limited: false,
          winsNeeded: 2,
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
    // Simulate real server returning TournamentTypeView objects instead of plain strings
    vi.mocked(cmds.getTournamentTypes).mockResolvedValueOnce([
      { name: 'Constructed Elimination', minPlayers: 2, maxPlayers: 16 } as unknown as string,
      { name: 'Constructed Swiss', minPlayers: 2, maxPlayers: 16 } as unknown as string,
      { name: 'Booster Draft', minPlayers: 4, maxPlayers: 8 } as unknown as string,
    ])

    render(<CreateTableDialog onClose={onClose} kind="tourney" />)

    // Wait for the async effect to resolve getTournamentTypes
    await waitFor(() => {
      expect(cmds.getTournamentTypes).toHaveBeenCalled()
    })

    // The tournament entry point renders the tournament tabs directly
    expect(screen.getByRole('tab', { name: /^Draft \/ Limit/i })).toBeDefined()
    expect(screen.getByRole('tab', { name: /^Construido/i })).toBeDefined()
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

  it('T12: DraftSetsSelector allows picking popular chips and configuring boosters with full visibility', async () => {
    render(<CreateTableDialog onClose={onClose} kind="tourney" />)

    goToStep('Draft')

    // Popular chips should be visible
    expect(screen.getByText('MH3')).toBeDefined()
    expect(screen.getByText('BLB')).toBeDefined()

    // Clicking MH3 chip sets all boosters
    fireEvent.click(screen.getByText('MH3'))
    const setsInput = screen.getByPlaceholderText(/Ej. M21, MH3, BLB/) as HTMLInputElement
    expect(setsInput.value).toContain('MH3')

    // Switch to custom per-booster mode
    fireEvent.click(screen.getByRole('tab', { name: /Personalizar cada sobre/i }))
    expect(screen.getByText(/Sobre 1/i)).toBeDefined()
    expect(screen.getByText(/Sobre 2/i)).toBeDefined()
    expect(screen.getByText(/Sobre 3/i)).toBeDefined()
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

  it('T13: creates table with COMPUTER_MAD and joins both the bot and human player', async () => {
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
    goToStep('Draft')
    const setsInput = await screen.findByPlaceholderText(/Ej\. M21, MH3, BLB/) as HTMLInputElement
    expect(setsInput.value).toBe('M21, M21, M21')
    const boosterSelect = screen
      .getAllByRole('combobox')
      .find((s) => (s as HTMLSelectElement).value === '3') as HTMLSelectElement
    expect(boosterSelect).toBeDefined()
    fireEvent.change(boosterSelect, { target: { value: '6' } })
    expect(setsInput.value).toBe('M21, M21, M21, M21, M21, M21')
    fireEvent.change(setsInput, { target: { value: 'M21, MH3, DSK' } })
    fireEvent.change(boosterSelect, { target: { value: '3' } })
    expect(setsInput.value).toBe('M21, MH3, DSK')
  })

  it('T15: draft con bots elegidos a mano se bloquea con aviso (no llegan a rondas)', async () => {
    render(<CreateTableDialog onClose={onClose} kind="tourney" />)
    fireEvent.change(screen.getByPlaceholderText(/Ej. Modern Casual Bo3/), { target: { value: 'Draft con bots' } })

    // walk to the seats step (the wizard is linear and draft adds timing options)
    for (let i = 0; i < 6; i++) {
      if (screen.queryByTestId('seat-node-0')) break
      const nextBtn = screen.queryByRole('button', { name: /Siguiente/ })
      if (!nextBtn) break
      fireEvent.click(nextBtn)
    }
    // default draft seats wait for humans (valid); pick the draftbot by hand to hit the guard
    await pickSeatType(1, /IA Draftbot/)
    for (let i = 0; i < 3; i++) {
      if (screen.queryByRole('button', { name: /Crear torneo|Create Draft/i })) break
      const nextBtn = screen.queryByRole('button', { name: /Siguiente/ })
      if (!nextBtn) break
      fireEvent.click(nextBtn)
    }
    fireEvent.click(screen.getByRole('button', { name: /Crear torneo|Create Draft/i }))

    await waitFor(() => {
      expect(screen.getByText(/no llegan a rondas/)).toBeDefined()
    })
    expect(cmds.createTournamentTable).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
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
