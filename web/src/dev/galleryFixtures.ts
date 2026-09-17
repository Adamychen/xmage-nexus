import type { FeedbackCard, FeedbackPrompt } from '../game/feedback'
import type {
  GameView,
  PlayerView,
  LobbyEnvelope,
  TableView,
  SeatView,
  UsersView,
  TournamentView,
  TournamentPlayerView,
  TournamentGameView,
  RoundView,
  SimpleCardView,
  SimpleCardsView,
} from '../net/types'
import type { DraftState, ConstructState } from '../state/slices/limited'
import type { ConnectionInfo } from '../state/persistence'
import manifest from '../../fixtures/recorded/manifest.json'

interface FrameModule {
  default: { gameId: string; gameView: GameView }
}

const frameModules = import.meta.glob<FrameModule>('../../fixtures/recorded/*.json', { eager: true })

// Fecha fija (no `Date.now()`): los datos de ejemplo del gallery se evalúan una
// vez por carga de página, así que un timestamp "en vivo" difiere entre la
// generación del baseline y cualquier ejecución posterior — hace flakear
// `toHaveScreenshot()` en cualquier pantalla que pinte una hora/fecha absoluta
// (p. ej. inicio/fin de torneo).
const GALLERY_EPOCH = new Date('2026-01-01T12:00:00Z').getTime()

export interface RecordedFrame {
  file: string
  mechanic: string
  note: string
  gameId: string
  gameView: GameView
}

export const recordedFrames: RecordedFrame[] = manifest
  .filter((entry) => entry.kind === 'game')
  .map((entry) => {
    const mod = frameModules[`../../fixtures/recorded/${entry.file}`]
    if (!mod?.default?.gameView) return null
    return {
      file: entry.file,
      mechanic: entry.mechanic,
      note: entry.note,
      gameId: mod.default.gameId,
      gameView: mod.default.gameView,
    }
  })
  .filter((frame): frame is RecordedFrame => frame != null)

export interface GalleryEntry {
  id: string
  group: string
  label: string
  description?: string
  phase?: 'idle' | 'lobby' | 'game'
  /** Pantalla no cubierta por `game`/`login`: lobby, editor de mazos, draft, construct, torneo. */
  screen?: 'lobby' | 'decks' | 'draft' | 'construct' | 'tournament'
  game?: GameView | null
  gameId?: string | null
  feedback?: FeedbackPrompt | null
  playableIds?: string[]
  lobby?: LobbyEnvelope
  conn?: ConnectionInfo
  draft?: DraftState
  construct?: ConstructState
  tournamentModal?: { table: TableView; view: TournamentView | null }
}

function players(game: GameView): PlayerView[] {
  return game.players ?? []
}

function controlledPlayer(game: GameView): PlayerView | undefined {
  return players(game).find((p) => p.controlled) ?? players(game)[0]
}

function opponentPlayer(game: GameView): PlayerView | undefined {
  return players(game).find((p) => p !== controlledPlayer(game)) ?? players(game)[1]
}

function battlefieldIds(player: PlayerView | undefined): string[] {
  return Object.keys(player?.battlefield ?? {})
}

function landIds(player: PlayerView | undefined): string[] {
  return Object.entries(player?.battlefield ?? {})
    .filter(([, perm]) => (perm.cardTypes ?? []).some((t) => String(t).toLowerCase() === 'land'))
    .map(([id]) => id)
}

function creatureIds(player: PlayerView | undefined): string[] {
  return Object.entries(player?.battlefield ?? {})
    .filter(([, perm]) => (perm.cardTypes ?? []).some((t) => String(t).toLowerCase() === 'creature'))
    .map(([id]) => id)
}

function cardOf(player: PlayerView | undefined, id: string): FeedbackCard {
  const perm = player?.battlefield?.[id]
  return {
    id,
    name: perm?.name ?? id,
    expansionSetCode: perm?.expansionSetCode,
    cardNumber: perm?.cardNumber,
    cardTypes: perm?.cardTypes,
  }
}

function targetPrompt(game: GameView, gameId: string, required: boolean): FeedbackPrompt {
  const me = controlledPlayer(game)
  const opponent = opponentPlayer(game)
  const targetId = creatureIds(opponent)[0] ?? battlefieldIds(opponent)[0] ?? creatureIds(me)[0] ?? battlefieldIds(me)[0] ?? 'target'
  const card = cardOf(opponent, targetId)
  return {
    method: 'GAME_TARGET',
    gameId,
    title: 'Select target creature',
    message: required ? 'Select target creature' : "Select up to one target creature you don't control",
    mode: 'uuid',
    options: [{ id: targetId, label: card.name, value: targetId }],
    min: 1,
    max: 1,
    required,
    sourceName: 'Lightning Bolt',
  }
}

const LIBRARY_CARDS: FeedbackCard[] = [
  { id: 'g1', name: 'Opt', expansionSetCode: 'M21', cardNumber: '59', cardTypes: ['Instant'] },
  { id: 'g2', name: 'Consider', expansionSetCode: 'MID', cardNumber: '44', cardTypes: ['Instant'] },
  { id: 'g3', name: 'Lightning Bolt', expansionSetCode: '2XM', cardNumber: '129', cardTypes: ['Instant'] },
  { id: 'g4', name: 'Counterspell', expansionSetCode: 'MH2', cardNumber: '267', cardTypes: ['Instant'] },
  { id: 'g5', name: 'Elvish Mystic', expansionSetCode: 'M14', cardNumber: '169', cardTypes: ['Creature'] },
  { id: 'g6', name: 'Forest', expansionSetCode: 'M21', cardNumber: '277', cardTypes: ['Land'] },
]

// ─── Pantallas nuevas (P3 núcleo, 2026-09-17): lobby, editor, draft, construct, torneo ──

const GALLERY_CONN: ConnectionInfo = {
  wsHost: 'localhost',
  proxyPort: 8787,
  serverHost: 'localhost',
  port: 17171,
  username: 'gallery-dev',
  password: '',
}

function makeSeat(playerName: string, seatIndex: number, playerType = 'Human'): SeatView {
  return { playerName, seatIndex, playerType }
}

const LOBBY_GAME_TYPES = ['Standard', 'Modern', 'Commander', 'Pauper', 'Draft (BLB)', 'Sealed (DSK)', 'Two-Headed Giant']
const LOBBY_NAMES = ['Alice', 'Bora', 'Chen', 'Dara', 'Enzo', 'Fran', 'Gus', 'Heidi']

function makeLobbyTable(i: number, overrides: Partial<TableView> = {}): TableView {
  const state = ['WAITING', 'DUELING', 'SIDEBOARDING', 'FINISHED'][i % 4]
  return {
    tableId: `gallery-table-${i}`,
    gameType: LOBBY_GAME_TYPES[i % LOBBY_GAME_TYPES.length],
    deckType: 'Constructed',
    tableName: `Mesa de ${LOBBY_NAMES[i % LOBBY_NAMES.length]} #${i + 1}`,
    controllerName: LOBBY_NAMES[i % LOBBY_NAMES.length],
    additionalInfoShort: '',
    additionalInfoFull: '',
    createTime: GALLERY_EPOCH - i * 60_000,
    tableState: state,
    skillLevel: 'CASUAL',
    tableStateText: state,
    seatsInfo: '1/4',
    isTournament: i % 7 === 0,
    seats: [makeSeat(LOBBY_NAMES[i % LOBBY_NAMES.length], 0), makeSeat('', 1, 'Open')],
    games: [],
    quitRatio: '0',
    minimumRating: '0',
    limited: i % 5 === 0,
    rated: i % 3 === 0,
    passworded: i % 9 === 0,
    spectatorsAllowed: true,
    ...overrides,
  }
}

function makeLobbyUser(i: number): UsersView {
  return {
    flagName: 'es',
    userName: `${LOBBY_NAMES[i % LOBBY_NAMES.length]}${i}`,
    matchHistory: '',
    matchQuitRatio: 0,
    tourneyHistory: '',
    tourneyQuitRatio: 0,
    infoGames: '0',
    infoPing: '20',
    generalRating: 1500 + i,
    constructedRating: 1500 + i,
    limitedRating: 1500 + i,
  }
}

const LOBBY_EMPTY: LobbyEnvelope = { type: 'lobby', tables: [], users: [], serverMessages: [] }

const LOBBY_OVERFLOW: LobbyEnvelope = {
  type: 'lobby',
  tables: Array.from({ length: 48 }, (_, i) => makeLobbyTable(i)),
  users: Array.from({ length: 55 }, (_, i) => makeLobbyUser(i)),
  serverMessages: [],
}

function makeSimpleCard(id: string, set: string, num: string, name: string): SimpleCardView {
  return { id, expansionSetCode: set, cardNumber: num, name }
}

function cardsById(cards: SimpleCardView[]): SimpleCardsView {
  const m: SimpleCardsView = {}
  for (const c of cards) m[c.id] = c
  return m
}

const DRAFT_SET_CODES = ['BLB', 'DSK', 'OTJ']
function makeDraftPack(prefix: string, size: number): SimpleCardView[] {
  return Array.from({ length: size }, (_, i) => {
    const set = DRAFT_SET_CODES[i % DRAFT_SET_CODES.length]
    return makeSimpleCard(`${prefix}-${i}`, set, String((i % 270) + 1), `${set} Card ${i}`)
  })
}

const DRAFT_INPROGRESS: DraftState = {
  draftId: 'gallery-draft-1',
  message: {
    draftView: {
      setNames: ['Bloomburrow'],
      setCodes: ['BLB'],
      boosterNum: 1,
      cardNum: 3,
      players: ['gallery-dev', 'alice', 'bora', 'chen', 'dara', 'enzo', 'fran', 'grace'],
    },
    draftPickView: {
      booster: cardsById(makeDraftPack('booster', 14)),
      picks: cardsById(makeDraftPack('pick', 2)),
      picking: true,
      timeout: 60,
    },
  },
  timeLeft: 42,
}

const DRAFT_WAITING: DraftState = {
  draftId: 'gallery-draft-2',
  message: {
    draftView: {
      setNames: ['Bloomburrow', 'Duskmourn', 'Outlaws of Thunder Junction'],
      setCodes: DRAFT_SET_CODES,
      boosterNum: 2,
      cardNum: 15,
      players: ['gallery-dev', 'alice-de-los-santos', 'bora-hernandez', 'chen-wei-long', 'dara-o-shaughnessy', 'enzo-fitzgerald', 'fran-de-la-cruz', 'grace-nakamura'],
    },
    draftPickView: { booster: {}, picks: cardsById(makeDraftPack('pick', 10)), picking: false, timeout: 60 },
  },
}

function makeConstructPool(size: number): SimpleCardsView {
  return cardsById(makeDraftPack('pool', size))
}

const CONSTRUCT_STATE_NORMAL: ConstructState = {
  deckName: 'Mi mazo sellado',
  pool: makeConstructPool(45),
  tableId: 'gallery-construct-1',
  parentTableId: null,
  timeLeft: 900,
}

const CONSTRUCT_STATE_BIG: ConstructState = {
  deckName: 'Pool grande (cubo)',
  pool: makeConstructPool(90),
  tableId: 'gallery-construct-2',
  parentTableId: null,
  timeLeft: 60,
}

function makeTournamentPlayer(name: string, points: number, state = 'ACTIVE'): TournamentPlayerView {
  return { name, state, points, results: '', history: '' }
}

function makeTournamentGame(roundNum: number, players: string, state: string, result = ''): TournamentGameView {
  return { roundNum, state, players, result }
}

const TOURNAMENT_TABLE = makeLobbyTable(0, { tableId: 'gallery-tournament-table', tableName: 'Standard Swiss #12', isTournament: true })

const TOURNAMENT_INPROGRESS: TournamentView = {
  tournamentName: 'Standard Swiss — Ronda 2 de 3',
  tournamentType: 'Swiss',
  tournamentState: 'DUELING',
  startTime: GALLERY_EPOCH - 30 * 60_000,
  constructionTime: 0,
  watchingAllowed: true,
  players: [
    makeTournamentPlayer('alice', 3),
    makeTournamentPlayer('bora', 3),
    makeTournamentPlayer('chen', 1.5),
    makeTournamentPlayer('dara', 1.5),
    makeTournamentPlayer('enzo', 0),
    makeTournamentPlayer('fran', 0),
  ],
  rounds: [
    { games: [makeTournamentGame(1, 'alice vs chen', 'COMPLETED', '2-0'), makeTournamentGame(1, 'bora vs dara', 'COMPLETED', '2-1'), makeTournamentGame(1, 'enzo vs fran', 'COMPLETED', '1-2')] },
    { games: [makeTournamentGame(2, 'alice vs bora', 'DUELING', ''), makeTournamentGame(2, 'dara vs fran', 'DUELING', ''), makeTournamentGame(2, 'chen vs enzo', 'DUELING', '')] },
  ] satisfies RoundView[],
}

const TOURNAMENT_FINISHED: TournamentView = {
  ...TOURNAMENT_INPROGRESS,
  tournamentName: 'Standard Swiss — Terminado',
  tournamentState: 'END',
  endTime: GALLERY_EPOCH,
  players: [
    makeTournamentPlayer('alice', 6, 'FINISHED'),
    makeTournamentPlayer('bora', 4.5, 'FINISHED'),
    makeTournamentPlayer('dara', 3, 'FINISHED'),
    makeTournamentPlayer('chen', 1.5, 'FINISHED'),
    makeTournamentPlayer('fran', 1.5, 'FINISHED'),
    makeTournamentPlayer('enzo', 0, 'FINISHED'),
  ],
  rounds: [
    TOURNAMENT_INPROGRESS.rounds[0],
    { games: [makeTournamentGame(2, 'alice vs bora', 'COMPLETED', '2-0'), makeTournamentGame(2, 'dara vs fran', 'COMPLETED', '2-1'), makeTournamentGame(2, 'chen vs enzo', 'COMPLETED', '2-0')] },
    { games: [makeTournamentGame(3, 'alice vs dara', 'COMPLETED', '2-0'), makeTournamentGame(3, 'bora vs fran', 'COMPLETED', '2-1'), makeTournamentGame(3, 'chen vs enzo', 'COMPLETED', '2-0')] },
  ],
}

export function buildGalleryEntries(): GalleryEntry[] {
  const entries: GalleryEntry[] = recordedFrames.map((frame) => ({
    id: `frame:${frame.mechanic}`,
    group: 'Frames reales',
    label: frame.mechanic,
    description: frame.note,
    phase: 'game',
    game: frame.gameView,
    gameId: frame.gameId,
  }))

  // gang-block es el frame con criaturas en ambos lados (objetivos realistas)
  // y tierras enderezadas del jugador controlado (pago de maná).
  const base =
    recordedFrames.find((f) => f.file === 'gang-block.json') ??
    recordedFrames.find((f) => f.file === 'combat.json') ??
    recordedFrames[0]
  if (base) {
    const { game, gameId } = { game: base.gameView, gameId: base.gameId }
    const me = controlledPlayer(game)
    const myLands = landIds(me)
    const myPermanents = battlefieldIds(me)
    const triggers = myPermanents.slice(0, 2).map((id) => cardOf(me, id))

    const prompts: { id: string; label: string; description: string; prompt: FeedbackPrompt; playableIds?: string[] }[] = [
      {
        id: 'prompt:target',
        label: 'GAME_TARGET (obligatorio)',
        description: 'Barra de objetivo con un candidato válido del rival.',
        prompt: targetPrompt(game, gameId, true),
      },
      {
        id: 'prompt:target-optional',
        label: 'GAME_TARGET (opcional)',
        description: '"Hasta N": aparece Terminar además de Cancelar.',
        prompt: targetPrompt(game, gameId, false),
      },
      {
        id: 'prompt:mana',
        label: 'GAME_PLAY_MANA',
        description: 'Pago de maná con fuentes resaltadas y botón especial.',
        prompt: {
          method: 'GAME_PLAY_MANA',
          gameId,
          title: 'Pay {1}{U}',
          message: 'Pay {1}{U}',
          mode: 'mana',
          options: [],
          min: 0,
          max: 0,
          playerId: me?.playerId,
        },
        playableIds: myLands,
      },
      {
        id: 'prompt:combat-attack',
        label: 'Combat (declarar atacantes)',
        description: 'Barra de combate con "atacar con todo" (special).',
        prompt: {
          method: 'GAME_SELECT',
          gameId,
          title: 'Declare attackers',
          message: 'Declare attackers',
          mode: 'combat',
          options: [],
          min: 0,
          max: 0,
          special: true,
        },
        playableIds: myPermanents,
      },
      {
        id: 'prompt:combat-block',
        label: 'Combat (declarar bloqueadores)',
        description: 'Barra de combate sin botón de ataque total.',
        prompt: {
          method: 'GAME_SELECT',
          gameId,
          title: 'Declare blockers',
          message: 'Declare blockers',
          mode: 'combat',
          options: [],
          min: 0,
          max: 0,
        },
      },
      {
        id: 'prompt:ask',
        label: 'GAME_ASK (Sí/No)',
        description: 'Pregunta genérica del motor con opciones booleanas.',
        prompt: {
          method: 'GAME_ASK',
          gameId,
          title: 'Solemn Simulacrum',
          message: 'Search your library for a basic land?',
          mode: 'boolean',
          options: [
            { id: 'yes', label: 'Sí', value: 'true' },
            { id: 'no', label: 'No', value: 'false' },
          ],
          min: 0,
          max: 0,
          sourceName: 'Solemn Simulacrum',
        },
      },
      {
        id: 'prompt:mulligan',
        label: 'Mulligan de Londres',
        description: 'Diálogo de mantener/mulligan con contador.',
        prompt: {
          method: 'GAME_ASK',
          gameId,
          title: 'Mulligan',
          message: 'Mulligan down to 6 cards?',
          mode: 'boolean',
          options: [
            { id: 'keep', label: 'Mantener (7)', value: 'false' },
            { id: 'mull', label: 'Mulligan', value: 'true' },
          ],
          min: 0,
          max: 0,
          isMulligan: true,
        },
      },
      {
        id: 'prompt:card-grid',
        label: 'Búsqueda en biblioteca (grid)',
        description: 'Grid HD de cartas con buscador para tutores.',
        prompt: {
          method: 'GAME_CHOOSE_CARDS',
          gameId,
          title: 'Search your library',
          message: 'Search your library for a card',
          mode: 'uuid',
          options: [],
          min: 0,
          max: 1,
          cards: LIBRARY_CARDS,
          sourceName: 'Demonic Tutor',
        },
      },
      {
        id: 'prompt:trigger-order',
        label: 'Orden de triggers',
        description: 'Dos triggers simultáneos sin orden fijado.',
        prompt: {
          method: 'GAME_TARGET',
          gameId,
          title: 'Order triggered abilities',
          message: 'Choose the order of triggered abilities',
          mode: 'uuid',
          options: triggers.map((c) => ({ id: c.id, label: c.name, value: c.id })),
          min: 1,
          max: 1,
          cards: triggers,
          isTriggerOrder: true,
        },
      },
      {
        id: 'prompt:voting',
        label: 'Votación (Council)',
        description: 'Voto de dos opciones con origen visible.',
        prompt: {
          method: 'GAME_CHOOSE_CHOICE',
          gameId,
          title: "Council's Judgment",
          message: 'Vote for a permanent — Step 1 of 2',
          mode: 'string',
          options: [
            { id: 'v1', label: 'Elvish Mystic', value: 'Elvish Mystic' },
            { id: 'v2', label: 'Forest', value: 'Forest' },
          ],
          min: 0,
          max: 0,
          isVoting: true,
        },
      },
    ]

    for (const p of prompts) {
      entries.push({
        id: p.id,
        group: 'Prompts',
        label: p.label,
        description: p.description,
        phase: 'game',
        game,
        gameId,
        feedback: p.prompt,
        playableIds: p.playableIds,
      })
    }
  }

  entries.push({
    id: 'screen:login',
    group: 'Pantallas',
    label: 'Login',
    description: 'Pantalla de conexión sin formulario enviado.',
    phase: 'idle',
  })

  entries.push({
    id: 'screen:lobby-empty',
    group: 'Pantallas',
    label: 'Lobby (vacío)',
    description: 'Sin mesas ni jugadores conectados.',
    screen: 'lobby',
    lobby: LOBBY_EMPTY,
    conn: GALLERY_CONN,
  })
  entries.push({
    id: 'screen:lobby-overflow',
    group: 'Pantallas',
    label: 'Lobby (desbordado)',
    description: '48 mesas y 55 jugadores conectados.',
    screen: 'lobby',
    lobby: LOBBY_OVERFLOW,
    conn: GALLERY_CONN,
  })
  entries.push({
    id: 'screen:decks',
    group: 'Pantallas',
    label: 'Editor de mazos',
    description:
      'Usa el almacenamiento real del navegador (IndexedDB): no se fuerzan mazos de ejemplo aquí para no contaminar tus mazos guardados con datos falsos.',
    screen: 'decks',
  })
  entries.push({
    id: 'screen:draft',
    group: 'Pantallas',
    label: 'Draft (pick en curso)',
    description: 'Booster de 14 cartas, pick 3 de la ronda 1, con 2 ya elegidas.',
    screen: 'draft',
    draft: DRAFT_INPROGRESS,
  })
  entries.push({
    id: 'screen:draft-waiting',
    group: 'Pantallas',
    label: 'Draft (esperando booster)',
    description: 'Booster vacío tras terminar el pick (picking:false) con nombres de jugador largos.',
    screen: 'draft',
    draft: DRAFT_WAITING,
  })
  entries.push({
    id: 'screen:construct',
    group: 'Pantallas',
    label: 'Construct (pool sellado)',
    description: '45 cartas de un sobre sellado típico.',
    screen: 'construct',
    construct: CONSTRUCT_STATE_NORMAL,
  })
  entries.push({
    id: 'screen:construct-overflow',
    group: 'Pantallas',
    label: 'Construct (pool grande)',
    description: '90 cartas: pool de cubo/sellado grande, desbordado.',
    screen: 'construct',
    construct: CONSTRUCT_STATE_BIG,
  })
  entries.push({
    id: 'screen:tournament-inprogress',
    group: 'Pantallas',
    label: 'Torneo (cuadro en curso)',
    description: 'Suizo a 3 rondas, ronda 2 en curso.',
    screen: 'tournament',
    tournamentModal: { table: TOURNAMENT_TABLE, view: TOURNAMENT_INPROGRESS },
  })
  entries.push({
    id: 'screen:tournament-finished',
    group: 'Pantallas',
    label: 'Torneo (cuadro terminado)',
    description: 'Torneo terminado con posiciones finales.',
    screen: 'tournament',
    tournamentModal: { table: TOURNAMENT_TABLE, view: TOURNAMENT_FINISHED },
  })

  return entries
}
