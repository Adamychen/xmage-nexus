import { parseFeedback, type FeedbackCard, type FeedbackPrompt } from '../game/feedback'
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
  ChatMessageEvent,
  GameEndInfo,
} from '../net/types'
import type { DraftState, ConstructState } from '../state/slices/limited'
import type { ConnectionInfo } from '../state/persistence'
import type { SupportedLanguage } from '../i18n'
import { STORAGE_KEY as CREATE_TABLE_STORAGE_KEY } from '../lobby/CreateTable/constants'
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

export type GalleryScreenName =
  | 'lobby'
  | 'decks'
  | 'draft'
  | 'construct'
  | 'tournament'
  | 'setup'
  | 'wizard'
  | 'staging'
  | 'settings'
  | 'appearance'
  | 'about'
  | 'help'
  | 'gameend'

export interface GalleryEntry {
  id: string
  group: string
  label: string
  description?: string
  phase?: 'idle' | 'connecting' | 'lobby' | 'game'
  /** Pantalla no cubierta por `game`/`login`: lobby, editor de mazos, draft, construct, torneo… */
  screen?: GalleryScreenName
  game?: GameView | null
  gameId?: string | null
  feedback?: FeedbackPrompt | null
  playableIds?: string[]
  lobby?: LobbyEnvelope
  conn?: ConnectionInfo
  draft?: DraftState
  construct?: ConstructState
  tournamentModal?: { table: TableView; view: TournamentView | null; loading?: boolean; error?: string | null }
  /** `tournament` del store: monta el TournamentPanel dentro de GameScreen. */
  tournament?: { tournamentId: string; view: TournamentView } | null
  /** Error del slice de sesión (banner de lobby / caja de LoginScreen). */
  error?: string | null
  gameEnd?: GameEndInfo | null
  /** Watchdog de cuña del draft (`lastDraftEventAt`); 0 = cuñado siempre. */
  lastDraftEventAt?: number | null
  /** `table` explícita de SpectatorStagingScreen (modo jugador). */
  stagingTable?: TableView
  chatMessages?: ChatMessageEvent[]
  boardLayout?: 'standard' | 'pod' | 'arena'
  uiScale?: number
  cjkBoost?: boolean
  /** Idioma de la i18n para este estado (se restaura al salir). */
  lang?: SupportedLanguage
  /** Sesión desconectada: App pinta el banner de reconexión. */
  connecting?: boolean
  /** Siembra de localStorage aplicada antes de montar (wizard de crear mesa). */
  storageSeed?: Record<string, string>
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

// ─── §4 matriz de estados (2026-09-17): variantes de tablero, pantallas y globales ──
// Todo lo de aquí se deriva de los frames grabados o de los props/slices reales de
// cada pantalla. Nada de backend: los estados que solo existen por respuesta del
// servidor (p. ej. `pickError` del draft) quedan documentados como pendientes.

const GALLERY_ISO = new Date(GALLERY_EPOCH).toISOString()
const GALLERY_ISO_END = new Date(GALLERY_EPOCH + 14 * 60_000).toISOString()

const GANG_BLOCK_FRAME = recordedFrames.find((f) => f.file === 'gang-block.json')
const COMMANDER_FRAME = recordedFrames.find((f) => f.file === 'commander-free-mulligan.json')
const SLICER_ASK_RULE =
  "At the beginning of each opponent's upkeep, you may have that player gain control of {this} until end of turn. If you do, untap {this}, goad it, and it can't be sacrificed this turn. If you don't, convert it."

type MutableRecord = Record<string, unknown>

function isPlainObject(value: unknown): value is MutableRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Clona reemplazando ids (claves y valores) por el mapa dado; el resto tal cual. */
function remapIds<T>(value: T, map: (id: string) => string | undefined): T {
  if (typeof value === 'string') return (map(value) ?? value) as unknown as T
  if (Array.isArray(value)) return value.map((v) => remapIds(v, map)) as unknown as T
  if (isPlainObject(value)) {
    const out: MutableRecord = {}
    for (const [k, v] of Object.entries(value)) out[map(k) ?? k] = remapIds(v, map)
    return out as unknown as T
  }
  return value
}

function playerCardIds(player: PlayerView): Set<string> {
  const ids = new Set<string>([player.playerId])
  const addKeys = (zone: unknown) => {
    if (isPlainObject(zone)) for (const id of Object.keys(zone)) ids.add(id)
  }
  addKeys(player.battlefield)
  addKeys(player.graveyard)
  addKeys(player.exile)
  addKeys(player.sideboard)
  addKeys(player.helperCards)
  for (const card of (player.commandList ?? []) as Array<{ id?: string }>) {
    if (card?.id) ids.add(card.id)
  }
  const topCard = player.topCard as { id?: string } | null | undefined
  if (topCard?.id) ids.add(topCard.id)
  return ids
}

/** FFA sintético: clona un rival del frame con ids únicos (uuid + sufijo) y su mano. */
function withClonedOpponent(game: GameView, src: PlayerView | undefined, suffix: string, name?: string): GameView {
  if (!src) return game
  const ids = playerCardIds(src)
  const map = (id: string) => (ids.has(id) ? `${id}-${suffix}` : undefined)
  const clone = { ...remapIds(src, map), name: name ?? src.name }
  const srcHand = game.opponentHands?.[src.playerId]
  const opponentHands = srcHand ? { ...(game.opponentHands ?? {}), [clone.playerId]: remapIds(srcHand, map) } : game.opponentHands
  return { ...game, players: [...players(game), clone], opponentHands }
}

/** Mano sintética de N cartas reutilizando las del frame con ids nuevos. */
function withHandSize(game: GameView, size: number): GameView {
  const hand = (game.myHand ?? {}) as Record<string, unknown>
  const entries = Object.entries(hand)
  if (entries.length === 0 || entries.length >= size) return game
  const next: Record<string, unknown> = { ...hand }
  let i = 0
  while (Object.keys(next).length < size) {
    const [id, card] = entries[i % entries.length]
    const nextId = `${id}-x${i + 1}`
    next[nextId] = { ...(remapIds(card, (v) => (v === id ? nextId : undefined)) as MutableRecord), id: nextId }
    i++
  }
  const me = controlledPlayer(game)
  return {
    ...game,
    myHand: next as GameView['myHand'],
    players: players(game).map((p) => (p === me ? { ...p, handCount: size } : p)),
  }
}

const LONG_ME = 'Alejandro-de-la-Vega-Fernández-Castillo'
const LONG_OPP = 'Bartholomew-Montgomery-Fitzwilliam-III'
const LONG_CARD = 'Asmoranomardicadaistinaculdacar'

/** Nombres largos de jugador y de carta (desbordado de etiquetas). */
function withLongNames(game: GameView): GameView {
  const renamed = players(game).map((p) => ({ ...p, name: p.controlled ? LONG_ME : LONG_OPP }))
  const me = renamed.find((p) => p.controlled)
  const renameFirst = (zone: unknown): unknown => {
    if (!isPlainObject(zone)) return zone
    const out: MutableRecord = {}
    let first = true
    for (const [id, card] of Object.entries(zone)) {
      out[id] = first && isPlainObject(card) ? { ...card, name: LONG_CARD, displayName: LONG_CARD, displayFullName: LONG_CARD } : card
      first = false
    }
    return out
  }
  const activeName = game.activePlayerId === me?.playerId ? LONG_ME : game.activePlayerId ? LONG_OPP : game.activePlayerName
  return {
    ...game,
    players: renamed.map((p) => (p === me ? { ...p, battlefield: renameFirst(p.battlefield) as PlayerView['battlefield'] } : p)),
    myHand: renameFirst(game.myHand) as GameView['myHand'],
    activePlayerName: activeName,
    priorityPlayerName: game.priorityPlayerName ? activeName : game.priorityPlayerName,
  }
}

// gang-block es 1v1: se clona DOS veces el rival del frame (c1/c2) para llegar a 4.
const FOUR_PLAYER_GAME = GANG_BLOCK_FRAME
  ? (() => {
      const game = GANG_BLOCK_FRAME.gameView
      const opp = opponentPlayer(game)
      return withClonedOpponent(withClonedOpponent(game, opp, 'c1', 'sim-000042'), opp, 'c2', 'sim-000043')
    })()
  : null
const THREE_PLAYER_COMMANDER = COMMANDER_FRAME?.gameView ?? null
const HAND_15_GAME = GANG_BLOCK_FRAME ? withHandSize(GANG_BLOCK_FRAME.gameView, 15) : null
const LONG_NAMES_GAME = GANG_BLOCK_FRAME ? withLongNames(GANG_BLOCK_FRAME.gameView) : null

const STAGING_TABLE = makeLobbyTable(0, {
  tableId: 'gallery-staging-table',
  tableName: 'Duelo de bienvenida',
  gameType: 'Two Player Duel',
  deckType: 'Constructed - Pioneer',
  controllerName: 'gallery-dev',
  tableState: 'WAITING',
  tableStateText: 'Waiting for players',
  seatsInfo: '2/2',
  seats: [
    { playerName: 'gallery-dev', seatIndex: 0, playerType: 'HUMAN', flagName: 'es', constructedRating: 1520, history: '3-1' },
    { playerName: 'bora-the-bold', seatIndex: 1, playerType: 'HUMAN', flagName: 'ru', constructedRating: 1602, history: '12-5' },
  ],
})

const STAGING_CHAT: ChatMessageEvent[] = [
  { chatId: 'gallery-staging-chat', username: 'gallery-dev', message: '[NEXUS_NOT_READY] gallery-dev', time: GALLERY_EPOCH },
  { chatId: 'gallery-staging-chat', username: 'bora-the-bold', message: '[NEXUS_READY] bora-the-bold', time: GALLERY_EPOCH + 1000 },
]

const GAME_END_GAME: GameEndInfo = {
  won: false,
  gameInfo: `${LONG_OPP} has won the game`,
  wins: 0,
  loses: 1,
  winsNeeded: 2,
  startTime: GALLERY_ISO,
  endTime: GALLERY_ISO_END,
  matchView: { matchId: 'gallery-match-1', result: '', players: `${LONG_ME} vs ${LONG_OPP}`, games: ['1'], startTime: GALLERY_ISO, endTime: null },
}

const GAME_END_MATCH: GameEndInfo = {
  won: true,
  gameInfo: `${LONG_ME} has won the game`,
  matchInfo: `${LONG_ME} has won the match 2-1`,
  wins: 2,
  loses: 1,
  winsNeeded: 2,
  startTime: GALLERY_ISO,
  endTime: GALLERY_ISO_END,
  matchView: { matchId: 'gallery-match-1', result: '2-1', players: `${LONG_ME} vs ${LONG_OPP}`, games: ['1', '2', '3'], startTime: GALLERY_ISO, endTime: GALLERY_ISO_END },
}

// Estado real del wire: `TournamentView.tournamentState` es el texto del
// `TableState` del fork ("Constructing"/"Dueling"/"Finished"), no el enum.
const TOURNAMENT_WAITING: TournamentView = {
  ...TOURNAMENT_INPROGRESS,
  tournamentName: 'Standard Swiss — En construcción',
  tournamentState: 'Constructing',
  startTime: GALLERY_EPOCH - 2 * 60_000,
  constructionTime: 600,
  rounds: [],
}

// Formulario persistido «Draft MH3 (8P)»: el wizard lo relee al montar (la
// combinación inválida NO es representable: los setters y un efecto de montaje
// la auto-corrigen, ver `useCreateTableForm`). `seatConfigs` = 7 asientos SIM.
const WIZARD_DRAFT_FORM = JSON.stringify({
  tableCategory: 'tourney',
  tournamentCategory: 'limited',
  useDraftTournament: true,
  name: 'Draft MH3 de la galería',
  gameType: 'Two Player Duel',
  deckType: 'Limited',
  wins: 2,
  skillLevel: 'CASUAL',
  rated: false,
  numPlayers: 8,
  seatConfigs: Array.from({ length: 7 }, () => ({ type: 'SIM', deckName: '', skill: 2 })),
})

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

  const slicerFrame = recordedFrames.find((frame) => frame.file === 'slicer.json')
  const slicerAsk = slicerFrame
    ? parseFeedback('GAME_ASK', slicerFrame.gameId, {
        message: SLICER_ASK_RULE,
        options: { secondMessage: 'Slicer, Hired Muscle' },
      })
    : null
  if (slicerFrame && slicerAsk) {
    entries.push({
      id: 'prompt:ask-slicer',
      group: 'Prompts',
      label: 'GAME_ASK (Slicer, Hired Muscle)',
      description: 'Pregunta real del motor con {this}: el saneado la resuelve con sourceName.',
      phase: 'game',
      game: slicerFrame.gameView,
      gameId: slicerFrame.gameId,
      feedback: slicerAsk,
    })
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
  entries.push({
    id: 'screen:tournament-loading',
    group: 'Pantallas',
    label: 'Torneo (cargando)',
    description: 'Cuadro sin datos mientras llega TOURNAMENT_INIT (loading).',
    screen: 'tournament',
    tournamentModal: { table: TOURNAMENT_TABLE, view: null, loading: true },
  })
  entries.push({
    id: 'screen:tournament-error',
    group: 'Pantallas',
    label: 'Torneo (error)',
    description: 'Fallo al pedir el cuadro (prop error del modal).',
    screen: 'tournament',
    tournamentModal: { table: TOURNAMENT_TABLE, view: null, error: 'No se pudo cargar el cuadro del torneo' },
  })
  entries.push({
    id: 'screen:tournament-empty',
    group: 'Pantallas',
    label: 'Torneo (sin datos)',
    description: 'Carga terminada sin vista todavía: estado vacío del modal.',
    screen: 'tournament',
    tournamentModal: { table: TOURNAMENT_TABLE, view: null },
  })
  entries.push({
    id: 'screen:tournament-waiting',
    group: 'Pantallas',
    label: 'Torneo (en construcción)',
    description: 'Constructing con 6 jugadores y 0 rondas: espera antes del primer emparejamiento.',
    screen: 'tournament',
    tournamentModal: { table: TOURNAMENT_TABLE, view: TOURNAMENT_WAITING },
  })
  entries.push({
    id: 'screen:draft-stalled',
    group: 'Pantallas',
    label: 'Draft (cuñado)',
    description: 'Watchdog sin eventos desde hace >150 s: aviso + botón Reintentar.',
    screen: 'draft',
    draft: DRAFT_INPROGRESS,
    lastDraftEventAt: 0,
  })
  entries.push({
    id: 'screen:setup',
    group: 'Pantallas',
    label: 'Setup wizard',
    description: 'Primera ejecución: configuración de proxy y servidor.',
    phase: 'idle',
    screen: 'setup',
  })
  entries.push({
    id: 'screen:login-connecting',
    group: 'Pantallas',
    label: 'Login (conectando)',
    description: 'Formulario enviado: botón Conectando… con spinner y envío bloqueado.',
    phase: 'connecting',
    conn: GALLERY_CONN,
  })
  entries.push({
    id: 'screen:login-error',
    group: 'Pantallas',
    label: 'Login (error de conexión)',
    description: 'Error del slice de sesión traducido en la caja de login.',
    phase: 'idle',
    error: 'No se pudo conectar al proxy',
  })
  entries.push({
    id: 'screen:lobby-error',
    group: 'Pantallas',
    label: 'Lobby (error)',
    description: 'ErrorBanner del lobby con el lobby cargado detrás.',
    screen: 'lobby',
    lobby: LOBBY_OVERFLOW,
    conn: GALLERY_CONN,
    error: 'No se pudo conectar al proxy',
  })
  entries.push({
    id: 'screen:wizard',
    group: 'Pantallas',
    label: 'Crear mesa (wizard)',
    description:
      'Formulario persistido «Draft MH3 (8P)»: rama de torneo limitado con resumen y 8 asientos. (La combinación inválida no es representable: los setters la auto-corrigen.)',
    phase: 'game',
    screen: 'wizard',
    storageSeed: { [CREATE_TABLE_STORAGE_KEY]: WIZARD_DRAFT_FORM },
  })
  entries.push({
    id: 'screen:staging-player',
    group: 'Pantallas',
    label: 'Sala de espera (jugador)',
    description: 'Mesa 2/2 con roster, listo/no listo y cambio de mazo.',
    phase: 'game',
    screen: 'staging',
    conn: GALLERY_CONN,
    lobby: LOBBY_OVERFLOW,
    stagingTable: STAGING_TABLE,
    chatMessages: STAGING_CHAT,
  })
  entries.push({
    id: 'screen:tournament-panel',
    group: 'Pantallas',
    label: 'Torneo (panel en partida)',
    description: 'TournamentPanel durante una partida de torneo (cuadro + chat).',
    phase: 'game',
    game: GANG_BLOCK_FRAME?.gameView ?? null,
    gameId: GANG_BLOCK_FRAME?.gameId ?? null,
    tournament: { tournamentId: 'gallery-tournament-1', view: TOURNAMENT_INPROGRESS },
  })
  entries.push({
    id: 'screen:gameend-game',
    group: 'Pantallas',
    label: 'Fin de partida (el match sigue)',
    description: 'Derrota en el juego 1 de un Bo3 con marcador y "el match continúa".',
    screen: 'gameend',
    game: GANG_BLOCK_FRAME?.gameView ?? null,
    gameId: GANG_BLOCK_FRAME?.gameId ?? null,
    gameEnd: GAME_END_GAME,
  })
  entries.push({
    id: 'screen:gameend-match',
    group: 'Pantallas',
    label: 'Fin de match (victoria)',
    description: 'Match Bo3 ganado 2-1: ganador, marcador y volver al lobby.',
    screen: 'gameend',
    game: GANG_BLOCK_FRAME?.gameView ?? null,
    gameId: GANG_BLOCK_FRAME?.gameId ?? null,
    gameEnd: GAME_END_MATCH,
  })
  entries.push({
    id: 'screen:settings',
    group: 'Pantallas',
    label: 'Ajustes',
    description: 'SettingsModal (idioma, interfaz, tablero, sonido, juego).',
    phase: 'game',
    screen: 'settings',
  })
  entries.push({
    id: 'screen:appearance',
    group: 'Pantallas',
    label: 'Apariencia',
    description: 'Zoom, disposición de tablero y fundas.',
    phase: 'game',
    screen: 'appearance',
  })
  entries.push({
    id: 'screen:about',
    group: 'Pantallas',
    label: 'Acerca de',
    description: 'Versión, créditos y enlaces (sin pestaña de noticias: usa red).',
    phase: 'idle',
    screen: 'about',
  })
  entries.push({
    id: 'screen:help',
    group: 'Pantallas',
    label: 'Ayuda / wiki',
    description: 'Glosario de keywords, fases y atajos.',
    phase: 'game',
    screen: 'help',
  })

  // Variantes de tablero: settings.boardLayout real decide el layout efectivo
  // (`effectiveBoardLayout`: pod/arena solo con rivales; >4 jugadores ⇒ standard).
  entries.push({
    id: 'board:pod-4',
    group: 'Tablero',
    label: 'Pod 2×2 (4 jugadores)',
    description: 'FFA de 4 con layout pod: rejilla 2×2 y anillo de turno.',
    phase: 'game',
    game: FOUR_PLAYER_GAME,
    gameId: GANG_BLOCK_FRAME?.gameId ?? null,
    boardLayout: 'pod',
  })
  entries.push({
    id: 'board:arena-4',
    group: 'Tablero',
    label: 'Arena (4 jugadores)',
    description: 'Mismo FFA de 4 con layout arena: rivales en columnas compactas.',
    phase: 'game',
    game: FOUR_PLAYER_GAME,
    gameId: GANG_BLOCK_FRAME?.gameId ?? null,
    boardLayout: 'arena',
  })
  entries.push({
    id: 'board:pod-commander',
    group: 'Tablero',
    label: 'Pod Commander (3 jugadores)',
    description: 'Commander Free For All de 3: zona de mando por rival y anillo.',
    phase: 'game',
    game: THREE_PLAYER_COMMANDER,
    gameId: COMMANDER_FRAME?.gameId ?? null,
    boardLayout: 'pod',
  })
  entries.push({
    id: 'game:hand-15',
    group: 'Tablero',
    label: 'Mano de 15 cartas',
    description: 'Mano desbordada (15 cartas) sobre el frame gang-block.',
    phase: 'game',
    game: HAND_15_GAME,
    gameId: GANG_BLOCK_FRAME?.gameId ?? null,
  })
  entries.push({
    id: 'game:long-names',
    group: 'Tablero',
    label: 'Nombres largos',
    description: 'Jugadores y cartas con nombres muy largos (desbordado de etiquetas).',
    phase: 'game',
    game: LONG_NAMES_GAME,
    gameId: GANG_BLOCK_FRAME?.gameId ?? null,
  })

  // Estados globales: idioma, zoom y conexión (slices reales de la app).
  entries.push({
    id: 'global:lang-lobby-ru',
    group: 'Global',
    label: 'Lobby en ruso (idioma largo)',
    description: 'Traducción ru sobre el lobby desbordado: etiquetas más largas.',
    screen: 'lobby',
    lobby: LOBBY_OVERFLOW,
    conn: GALLERY_CONN,
    lang: 'ru',
  })
  entries.push({
    id: 'global:lang-game-ja',
    group: 'Global',
    label: 'Partida en japonés (CJK)',
    description: 'Traducción ja + cjkBoost sobre un frame real.',
    phase: 'game',
    game: GANG_BLOCK_FRAME?.gameView ?? null,
    gameId: GANG_BLOCK_FRAME?.gameId ?? null,
    lang: 'ja',
    cjkBoost: true,
  })
  entries.push({
    id: 'global:zoom-lobby-125',
    group: 'Global',
    label: 'Lobby a zoom 125%',
    description: 'settings.uiScale = 1.25 (el tablero lo compensa con inverseZoom).',
    screen: 'lobby',
    lobby: LOBBY_OVERFLOW,
    conn: GALLERY_CONN,
    uiScale: 1.25,
  })
  entries.push({
    id: 'global:reconnecting',
    group: 'Global',
    label: 'Desconectado (reconectando)',
    description: 'connecting + wsAlive:false: banner de reconexión de la app.',
    screen: 'lobby',
    lobby: LOBBY_OVERFLOW,
    conn: GALLERY_CONN,
    connecting: true,
  })

  return entries
}
