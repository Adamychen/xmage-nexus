import { getState, setState } from '../state/state'
import { parseFeedback, type FeedbackCard, type FeedbackPrompt } from '../game/feedback'
import { TOP_CARD_PEEK_NAME } from '../game/topCardPeek'
import { landTapColor } from '../board/compactCard'
import type { AuraKeyword } from '../board/keywordAura'
import { forgetCoinFlip } from '../board/coinFlipFx'
import type {
  CardView,
  GameView,
  PermanentView,
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
import type { Deck } from '../lobby/decks'
import type { RollbackVote } from '../state/rollbackVote'
import { STORAGE_KEY as CREATE_TABLE_STORAGE_KEY } from '../lobby/CreateTable/constants'
import manifest from '../../fixtures/recorded/manifest.json'
import { replayProjectileDemo } from './projectileDemo'
import type { GameUi } from '../game/gameUi'
import { handleChatMessage } from '../state/events/chat'
import { STEPS } from '../game/phaseSteps'
import { observeTurnRecap, resetTurnRecap, type TurnRecap } from '../game/turnRecap'
import { CAST_FLIGHT_MS } from '../board/flightManager'

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
  | 'cards'
  | 'projectile'
  | 'glyphs'

/** Acción de dev de una entrada: un botón en el sidebar que modifica el estado de la galería. */
export interface GalleryAction {
  label: string
  /** Transforma el `game` del store (p. ej. añadir una carta a la mano). */
  apply?: (game: GameView) => GameView
  /** Efecto directo sobre el DOM o el store cuando no basta con `apply`. */
  run?: () => void
}

export interface GalleryEntry {
  id: string
  group: string
  label: string
  action?: GalleryAction
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
  stagingMode?: 'player' | 'spectator'
  /** Deck in play (`myDeck` in the store); omitted = keep the current one. */
  myDeck?: Deck | null
  chatMessages?: ChatMessageEvent[]
  boardLayout?: 'standard' | 'pod' | 'arena'
  /** Main board with side panel (`boardSpotlight`, BRD-6); omitted = the viewer's setting. */
  boardSpotlight?: boolean
  seatFocus?: string
  /** Table interface for this state; omitted = the viewer's setting. */
  gameUi?: GameUi
  /** Rollback vote dialog state (`rollbackVote` in the store). */
  rollbackVote?: RollbackVote | null
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
  { id: 'g3', name: 'Lightning Bolt', expansionSetCode: 'M10', cardNumber: '146', cardTypes: ['Instant'] },
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

// Real `User.getPingInfo()` shapes, captured through the proxy: the last one is
// what our own connections carry (nobody measures a browser's latency), and the
// badge stays hidden for it.
const GALLERY_PINGS = [
  '22ms (avg: 24ms)  (online: 4:11; seen: 1 sec ago)',
  '112ms (avg: 120ms)  (online: 1:02; seen: 3 sec ago)',
  '240ms (avg: 205ms)  (online: 0:40; seen: 8 sec ago)',
  '  (online: 0:00; seen: 2 sec ago)',
]

function makeLobbyUser(i: number): UsersView {
  return {
    flagName: 'es',
    userName: `${LOBBY_NAMES[i % LOBBY_NAMES.length]}${i}`,
    matchHistory: '',
    matchQuitRatio: 0,
    tourneyHistory: '',
    tourneyQuitRatio: 0,
    infoGames: '0',
    infoPing: GALLERY_PINGS[i % GALLERY_PINGS.length],
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
const COMMANDER_ZONE_FRAME = recordedFrames.find((f) => f.file === 'commander-zone.json')
const EMBLEM_FRAME = recordedFrames.find((f) => f.file === 'emblem.json')
const DUNGEON_FRAME = recordedFrames.find((f) => f.file === 'dungeon.json')
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
  const clone = { ...remapIds(src, map), name: name ?? src.name, hasPriority: false, isActive: false }
  const srcHand = game.opponentHands?.[src.playerId]
  const opponentHands = srcHand ? { ...(game.opponentHands ?? {}), [clone.playerId]: remapIds(srcHand, map) } : game.opponentHands
  return { ...game, players: [...players(game), clone], opponentHands }
}

/** Mano sintética de N cartas reutilizando las del frame con ids nuevos. */
function withHandSize(game: GameView, size: number): GameView {
  const hand = (game.myHand ?? {}) as Record<string, unknown>
  const entries = Object.entries(hand)
  if (entries.length === 0 || entries.length === size) return game
  const next: Record<string, unknown> = entries.length > size ? Object.fromEntries(entries.slice(0, size)) : { ...hand }
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

/** Rellena el campo de cada jugador clonando sus criaturas/tierras hasta N (ids nuevos). */
function withCrowdedBattlefields(game: GameView, creatures: number, lands: number): GameView {
  const grow = (player: PlayerView, kind: 'creature' | 'land', target: number): PlayerView => {
    const battlefield = { ...(player.battlefield ?? {}) } as unknown as Record<string, MutableRecord>
    const pool = Object.entries(battlefield).filter(([, perm]) =>
      (perm.cardTypes as string[] | undefined ?? []).some((t) => String(t).toLowerCase() === kind),
    )
    if (pool.length === 0) return player
    let have = pool.length
    let i = 0
    while (have < target) {
      const [id, perm] = pool[i % pool.length]
      const nextId = `${id}-crowd${i + 1}`
      battlefield[nextId] = { ...(remapIds(perm, (v) => (v === id ? nextId : undefined)) as MutableRecord), id: nextId, attachments: [] }
      have++
      i++
    }
    return { ...player, battlefield: battlefield as unknown as PlayerView['battlefield'] }
  }
  return {
    ...game,
    players: players(game).map((p) => grow(grow(p, 'creature', creatures), 'land', lands)),
  }
}

/** Four Commander seats with every kind of permanent: lands, mana rocks, Treasures, a planeswalker and a saga (BRD-1, BRD-2). */
function withKindColumnsBoard(game: GameView): GameView {
  const card = (owner: string, id: string, name: string, cardTypes: string[], extra: MutableRecord = {}): [string, MutableRecord] => [
    `${owner}-${id}`,
    { id: `${owner}-${id}`, parentId: `${owner}-${id}`, name, displayName: name, cardTypes, manaValue: 0, expansionSetCode: '', cardNumber: '0', controllerId: owner, ...extra },
  ]
  const treasure = (owner: string, n: number): [string, MutableRecord] => card(owner, `treasure-${n}`, 'Treasure', ['ARTIFACT'], { isToken: true, mageObjectType: 'TOKEN' })
  return {
    ...game,
    players: players(game).map((p, seat) => {
      const owner = p.playerId
      const extras: [string, MutableRecord][] = [
        card(owner, 'plains-1', 'Plains', ['LAND']),
        card(owner, 'plains-2', 'Plains', ['LAND']),
        card(owner, 'plains-3', 'Plains', ['LAND']),
        card(owner, 'island', 'Island', ['LAND']),
        card(owner, 'sol-ring', 'Sol Ring', ['ARTIFACT']),
        card(owner, 'signet', 'Arcane Signet', ['ARTIFACT']),
        treasure(owner, 1),
        treasure(owner, 2),
        treasure(owner, 3),
      ]
      if (seat % 2 === 0) extras.push(card(owner, 'walker', 'Jace, the Mind Sculptor', ['PLANESWALKER']))
      if (seat % 2 === 1) extras.push(card(owner, 'saga', 'Saga of Ancient Lore', ['ENCHANTMENT', 'SAGA']))
      return { ...p, battlefield: { ...(p.battlefield ?? {}), ...Object.fromEntries(extras) } as unknown as PlayerView['battlefield'] }
    }),
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
const CROWDED_POD_GAME = FOUR_PLAYER_GAME ? withCrowdedBattlefields(FOUR_PLAYER_GAME, 16, 14) : null
const KIND_COLUMNS_GAME = FOUR_PLAYER_GAME ? withKindColumnsBoard(FOUR_PLAYER_GAME) : null
const THREE_PLAYER_COMMANDER = COMMANDER_FRAME?.gameView ?? null
const HAND_15_GAME = GANG_BLOCK_FRAME ? withHandSize(GANG_BLOCK_FRAME.gameView, 15) : null
const HAND_12_GAME = GANG_BLOCK_FRAME ? withHandSize(GANG_BLOCK_FRAME.gameView, 12) : null
const HAND_3_GAME = GANG_BLOCK_FRAME ? withHandSize(GANG_BLOCK_FRAME.gameView, 3) : null
const HAND_8_GAME = GANG_BLOCK_FRAME ? withHandSize(GANG_BLOCK_FRAME.gameView, 8) : null
const LONG_NAMES_GAME = GANG_BLOCK_FRAME ? withLongNames(GANG_BLOCK_FRAME.gameView) : null
const TOP_CARD_PEEK_GAME = GANG_BLOCK_FRAME ? withTopCardPeek(GANG_BLOCK_FRAME.gameView) : null

function drawOneCard(game: GameView): GameView {
  const hand = (game.myHand ?? {}) as Record<string, unknown>
  const sample = Object.values(hand)[0]
  if (!sample) return game
  const sampleId = String((sample as { id?: unknown }).id ?? '')
  const id = `gallery-drawn-${Date.now()}`
  const card = { ...(remapIds(sample, (v) => (v === sampleId ? id : undefined)) as MutableRecord), id }
  const me = controlledPlayer(game)
  return {
    ...game,
    myHand: { ...hand, [id]: card } as GameView['myHand'],
    players: players(game).map((p) => (p === me ? { ...p, handCount: (p.handCount ?? 0) + 1 } : p)),
  }
}

function passPriority(game: GameView): GameView {
  const all = players(game)
  const holder = all.find((p) => p.hasPriority)
  const next = all.find((p) => p !== holder)
  if (!next) return game
  return {
    ...game,
    priorityPlayerName: next.name,
    players: all.map((p) => (p === holder ? { ...p, hasPriority: false } : p === next ? { ...p, hasPriority: true } : p)),
  }
}

function rotatePriority(game: GameView): GameView {
  const all = players(game)
  const from = all.findIndex((p) => p.hasPriority)
  const next = all[(from + 1) % all.length]
  if (!next) return game
  return {
    ...game,
    priorityPlayerName: next.name,
    players: all.map((p) => ({ ...p, hasPriority: p === next })),
  }
}

function withPriorityOnRival(game: GameView): GameView {
  const all = players(game)
  const rival = all.find((p) => !p.controlled && !p.isActive && p.playerId !== game.activePlayerId)
  if (!rival) return game
  return {
    ...game,
    priorityPlayerName: rival.name,
    players: all.map((p) => ({ ...p, hasPriority: p === rival })),
  }
}

const LAND_POOL_KEY: Record<string, keyof PlayerView['manaPool']> = {
  W: 'white', U: 'blue', B: 'black', R: 'red', G: 'green', C: 'colorless',
}

function tapOneLand(game: GameView): GameView {
  const me = controlledPlayer(game)
  const landId = landIds(me).find((id) => !me?.battlefield?.[id]?.tapped)
  if (!me || !landId) return game
  const land = me.battlefield?.[landId]
  const color = land ? landTapColor(land as CardView) : null
  const poolKey = color ? LAND_POOL_KEY[color] : undefined
  const pool = poolKey
    ? { ...me.manaPool, [poolKey]: (me.manaPool?.[poolKey] ?? 0) + 1 }
    : me.manaPool
  return {
    ...game,
    players: players(game).map((p) => (p === me
      ? { ...p, manaPool: pool, battlefield: { ...p.battlefield, [landId]: { ...p.battlefield?.[landId], tapped: true } } }
      : p)) as PlayerView[],
  }
}

function withIdenticalSpellPile(game: GameView): GameView {
  const me = controlledPlayer(game)
  const controller = { controllerId: me?.playerId, controllerName: me?.name }
  const copy = (id: string) => ({ id, name: 'Lightning Bolt', expansionSetCode: 'M10', cardNumber: '146', cardTypes: ['INSTANT'], ...controller })
  return {
    ...game,
    stack: {
      'gallery-pile-1': copy('gallery-pile-1'),
      'gallery-pile-2': copy('gallery-pile-2'),
      'gallery-pile-3': copy('gallery-pile-3'),
    } as unknown as GameView['stack'],
  }
}

function pushStackEntry(game: GameView): GameView {
  const me = controlledPlayer(game)
  const id = 'gallery-push-' + Date.now()
  const spell = { id, name: 'Lightning Bolt', expansionSetCode: 'M10', cardNumber: '146', cardTypes: ['INSTANT'], controllerId: me?.playerId, controllerName: me?.name }
  return { ...game, stack: { [id]: spell, ...(game.stack ?? {}) } as unknown as GameView['stack'] }
}

function withMixedStackKinds(game: GameView): GameView {
  const me = controlledPlayer(game)
  const controller = { controllerId: me?.playerId, controllerName: me?.name }
  const stack = {
    'gallery-kind-trigger': { id: 'gallery-kind-trigger', name: 'Soul Warden', mageObjectType: 'TRIGGERED_ABILITY', abilityType: 'Triggered', rules: ['You gain 1 life.'], sourceCard: { name: 'Soul Warden', ...controller }, ...controller },
    'gallery-kind-spell': { id: 'gallery-kind-spell', name: 'Lightning Bolt', expansionSetCode: 'M10', cardNumber: '146', cardTypes: ['INSTANT'], ...controller },
    'gallery-kind-creature': { id: 'gallery-kind-creature', name: 'Mystic Snake', expansionSetCode: 'MH2', cardNumber: '50', cardTypes: ['CREATURE'], power: 2, toughness: 2, ...controller },
  }
  return { ...game, stack: stack as unknown as GameView['stack'] }
}

const BOLT_ON_STACK_ID = 'gallery-bolt-targeting'

function withBoltTargeting(game: GameView, targetId: string): GameView {
  const me = controlledPlayer(game)
  const bolt = {
    id: BOLT_ON_STACK_ID,
    name: 'Lightning Bolt',
    expansionSetCode: 'M10',
    cardNumber: '146',
    cardTypes: ['INSTANT'],
    controllerId: me?.playerId,
    controllerName: me?.name,
    rules: ['Lightning Bolt deals 3 damage to any target.'],
    targets: [targetId],
  }
  return { ...game, stack: { [BOLT_ON_STACK_ID]: bolt } as unknown as GameView['stack'] }
}

/** Resolves the bolt the way the server would; the store update runs the transition engine on the diff. */
function resolveBoltOn(targetId: string): (game: GameView) => GameView {
  return (game) => {
    const next: GameView = {
      ...game,
      stack: {} as unknown as GameView['stack'],
      players: players(game).map((p) => {
        const perm = p.battlefield?.[targetId]
        if (perm) {
          return { ...p, battlefield: { ...p.battlefield, [targetId]: { ...perm, damage: (perm.damage ?? 0) + 3 } } }
        }
        if (p.playerId === targetId) return { ...p, life: (p.life ?? 0) - 3 }
        return p
      }) as PlayerView[],
    }
    return next
  }
}

/** Four spells on the stack, top first: the top and third target the creature, the other two the player. */
function withFourStackSpells(game: GameView, creatureId: string, playerId: string): GameView {
  const me = controlledPlayer(game)
  const controller = { controllerId: me?.playerId, controllerName: me?.name }
  const spell = (id: string, name: string, set: string, cardNumber: string, target: string) => ({
    id,
    name,
    expansionSetCode: set,
    cardNumber,
    cardTypes: ['INSTANT'],
    rules: [`${name} deals 3 damage to any target.`],
    targets: [target],
    ...controller,
  })
  const stack = {
    'gallery-seq-1': spell('gallery-seq-1', 'Lightning Bolt', 'M10', '146', creatureId),
    'gallery-seq-2': spell('gallery-seq-2', 'Shock', '2XM', '135', playerId),
    'gallery-seq-3': spell('gallery-seq-3', 'Lightning Strike', '2XM', '140', creatureId),
    'gallery-seq-4': spell('gallery-seq-4', 'Searing Spear', '2XM', '146', playerId),
  }
  return { ...game, stack: stack as unknown as GameView['stack'] }
}

/**
 * Removes the whole stack in one update (the diff the transition engine launches from). The stack is
 * first re-created in its own update, so a press always produces a fresh diff; the two updates are
 * split by a macrotask so the engine sees each one.
 */
function replayStackSequence(full: GameView): () => void {
  return () => {
    setState({ game: full })
    setTimeout(() => {
      const current = getState().game
      if (current) setState({ game: { ...current, stack: {} as unknown as GameView['stack'] } })
    }, 0)
  }
}

function withSpellStack(game: GameView): GameView {
  const spell = (id: string, name: string, set: string, cardNumber: string) => ({ id, name, expansionSetCode: set, cardNumber, cardTypes: ['Instant'] })
  return {
    ...game,
    stack: {
      'gallery-stack-top': spell('gallery-stack-top', 'Lightning Bolt', 'M10', '146'),
      'gallery-stack-below': spell('gallery-stack-below', 'Counterspell', 'MH2', '267'),
    } as unknown as GameView['stack'],
  }
}

function simulateTargetDamage(): void {
  const card = document.querySelector<HTMLElement>('[data-gallery-stage] .card-slot.targetable')
  if (!card) return
  card.classList.remove('took-damage')
  void card.offsetWidth
  card.classList.add('took-damage')
  window.setTimeout(() => card.classList.remove('took-damage'), 1500)
}

/** Sin combate: ningún atacante mueve ni tapa cartas por su cuenta, así cada acción de galería es la única causa. */
function calmGame(game: GameView): GameView {
  return { ...game, combat: [] }
}

function mapOpponent(game: GameView, fn: (player: PlayerView) => PlayerView): GameView {
  const opponent = opponentPlayer(game)
  return { ...game, players: players(game).map((p) => (p === opponent ? fn(p) : p)) }
}

function mapControlled(game: GameView, fn: (player: PlayerView) => PlayerView): GameView {
  const me = controlledPlayer(game)
  return { ...game, players: players(game).map((p) => (p === me ? fn(p) : p)) }
}

function setControlledTapped(game: GameView, tapped: boolean): GameView {
  return mapControlled(game, (p) => ({
    ...p,
    battlefield: Object.fromEntries(
      Object.entries(p.battlefield ?? {}).map(([id, perm]) => [id, { ...perm, tapped }]),
    ),
  }))
}

function withLife(game: GameView, life: number): GameView {
  return mapControlled(game, (p) => ({ ...p, life }))
}

function loseLife(game: GameView, amount: number): GameView {
  return mapControlled(game, (p) => ({ ...p, life: (p.life ?? 0) - amount }))
}

function addSoldierToken(game: GameView): GameView {
  const id = `gallery-token-${Date.now()}`
  const token = {
    id,
    name: 'Soldier',
    displayName: 'Soldier',
    manaValue: 0,
    cardTypes: ['Creature'],
    subtypes: ['Soldier'],
    power: '1',
    toughness: '1',
    isToken: true,
    tapped: false,
  }
  return mapControlled(game, (p) => ({
    ...p,
    battlefield: { ...p.battlefield, [id]: token },
  }))
}

let galleryCreatureSeq = 0

function addSickCreature(game: GameView): { game: GameView; id: string } {
  galleryCreatureSeq += 1
  const id = `gallery-creature-${galleryCreatureSeq}`
  const creature = {
    id,
    name: 'Grizzly Bears',
    displayName: 'Grizzly Bears',
    manaValue: 2,
    cardTypes: ['Creature'],
    subtypes: ['Bear'],
    power: '2',
    toughness: '2',
    tapped: false,
    summoningSickness: true,
  }
  return {
    id,
    game: mapControlled(game, (p) => ({
      ...p,
      battlefield: { ...p.battlefield, [id]: creature },
    })),
  }
}

const KEYWORD_AURA_CREATURES: Record<AuraKeyword, { name: string; power: string; toughness: string; manaValue: number; subtypes: string[]; rules: string[] }> = {
  indestructible: { name: 'Darksteel Myr', power: '0', toughness: '1', manaValue: 0, subtypes: ['Myr'], rules: ['Indestructible'] },
  hexproof: { name: 'Gladecover Scout', power: '1', toughness: '2', manaValue: 1, subtypes: ['Elf', 'Scout'], rules: ['Hexproof'] },
  deathtouch: { name: 'Typhoid Rats', power: '1', toughness: '1', manaValue: 1, subtypes: ['Rat'], rules: ['Deathtouch'] },
  flying: { name: 'Serra Angel', power: '4', toughness: '4', manaValue: 5, subtypes: ['Angel'], rules: ['Flying, vigilance'] },
  lifelink: { name: 'Child of Night', power: '2', toughness: '1', manaValue: 3, subtypes: ['Vampire'], rules: ['Lifelink'] },
  trample: { name: 'Colossal Dreadmaw', power: '6', toughness: '6', manaValue: 5, subtypes: ['Dinosaur'], rules: ['Trample'] },
  haste: { name: 'Raging Goblin', power: '1', toughness: '1', manaValue: 1, subtypes: ['Goblin'], rules: ['Haste'] },
}

function addKeywordCreatures(game: GameView): GameView {
  return mapControlled(game, (p) => ({
    ...p,
    battlefield: {
      ...p.battlefield,
      ...Object.fromEntries(
        (Object.entries(KEYWORD_AURA_CREATURES) as Array<[AuraKeyword, (typeof KEYWORD_AURA_CREATURES)[AuraKeyword]]>).map(([id, c]) => [
          `gallery-kw-${id}`,
          { id: `gallery-kw-${id}`, name: c.name, displayName: c.name, manaValue: c.manaValue, cardTypes: ['Creature'], subtypes: c.subtypes, power: c.power, toughness: c.toughness, tapped: false, summoningSickness: false, rules: c.rules },
        ]),
      ),
    },
  }))
}

function withKeywordGainBear(game: GameView): GameView {
  return mapControlled(game, (p) => ({
    ...p,
    battlefield: {
      ...p.battlefield,
      'gallery-kw-gain': { id: 'gallery-kw-gain', name: 'Grizzly Bears', displayName: 'Grizzly Bears', manaValue: 2, cardTypes: ['Creature'], subtypes: ['Bear'], power: '2', toughness: '2', tapped: false, summoningSickness: false, rules: [] },
    },
  }))
}

function withAuraGainBear(game: GameView): GameView {
  return mapControlled(withKeywordGainBear(game), (p) => ({
    ...p,
    battlefield: {
      ...p.battlefield,
      'gallery-aura': { id: 'gallery-aura', name: 'Flight Aura', displayName: 'Flight Aura', manaValue: 2, cardTypes: ['Enchantment'], subtypes: ['Aura'], tapped: false, rules: [] },
    },
  }))
}

function withAuraAttached(game: GameView, hostId: string, auraId: string, rules: string[]): GameView {
  return mapControlled(game, (p) => {
    const host = p.battlefield?.[hostId]
    if (!host) return p
    return { ...p, battlefield: { ...p.battlefield, [hostId]: { ...host, rules, attachments: [auraId] } } }
  })
}

function sendToGraveyard(game: GameView, id: string): GameView {
  return mapControlled(game, (p) => {
    const perm = p.battlefield?.[id]
    if (!perm) return p
    const battlefield = { ...p.battlefield }
    delete battlefield[id]
    return { ...p, battlefield, graveyard: { ...p.graveyard, [id]: perm } }
  })
}

function addDamage(game: GameView, id: string, amount: number): GameView {
  return mapControlled(game, (p) => {
    const perm = p.battlefield?.[id]
    if (!perm) return p
    return { ...p, battlefield: { ...p.battlefield, [id]: { ...perm, damage: (perm.damage ?? 0) + amount } } }
  })
}

/** The id a spell's card has once it leaves the stack: the server keys a stack spell by its spell ability id, not by its card id. */
function cardIdOf(spellId: string): string {
  return `${spellId}-card`
}

function bolt(id: string, controller: PlayerView | undefined): CardView {
  return {
    id,
    name: 'Lightning Bolt',
    displayName: 'Lightning Bolt',
    expansionSetCode: 'M10',
    cardNumber: '146',
    manaValue: 1,
    cardTypes: ['Instant'],
    rules: ['Lightning Bolt deals 3 damage to any target.'],
    controllerId: controller?.playerId,
    controllerName: controller?.name,
  }
}

/** Resuelve un hechizo de daño contra el jugador controlado: sale de la pila, va al cementerio de su controlador y la vida baja 3. */
function resolveDamageSpellAtMe(game: GameView, spellId: string, amount: number): GameView {
  const spell = game.stack?.[spellId]
  const me = controlledPlayer(game)
  if (!spell || !me) return game
  const stack = { ...(game.stack ?? {}) }
  delete stack[spellId]
  return {
    ...game,
    stack,
    players: players(game).map((p) => {
      if (p === me) return { ...p, life: (p.life ?? 0) - amount }
      if (p.playerId === spell.controllerId) return { ...p, graveyard: { ...p.graveyard, [cardIdOf(spellId)]: { ...spell, id: cardIdOf(spellId) } } }
      return p
    }),
  }
}

function withInstantInHand(game: GameView): GameView {
  const me = controlledPlayer(game)
  const id = 'gallery-instant-hand'
  return {
    ...game,
    myHand: { ...(game.myHand ?? {}), [id]: bolt(id, me) },
    players: players(game).map((p) => (p === me ? { ...p, handCount: (p.handCount ?? 0) + 1 } : p)),
  }
}

function removeFromHand(game: GameView, predicate: (card: CardView) => boolean): { id: string; hand: GameView['myHand']; card: CardView } | null {
  const hand = { ...(game.myHand ?? {}) }
  const id = Object.keys(hand).find((key) => hand[key] && predicate(hand[key]))
  if (!id) return null
  const card = hand[id]
  delete hand[id]
  return { id, hand, card }
}

const isType = (type: string) => (card: CardView) => (card.cardTypes ?? []).some((t) => String(t).toLowerCase() === type)

const OPP_SPELL_ID = 'gallery-opp-spell'

/** Adds (delta +1) or removes (delta -1) one card from an opponent's hand; the server only sends the count. */
function withOpponentHandDelta(game: GameView, owner: PlayerView | undefined, delta: number): GameView {
  if (!owner) return game
  return {
    ...game,
    players: players(game).map((p) => (p.playerId === owner.playerId
      ? { ...p, handCount: Math.max(0, (p.handCount ?? 0) + delta) }
      : p)) as PlayerView[],
  }
}

/** Casts the opponent's instant from their hand: the hand count drops and the spell goes on the stack. */
function castOpponentBolt(game: GameView, owner: PlayerView | undefined): GameView {
  if (!owner) return game
  const next = withOpponentHandDelta(game, owner, -1)
  return { ...next, stack: { ...(next.stack ?? {}), [OPP_SPELL_ID]: bolt(OPP_SPELL_ID, owner) } as unknown as GameView['stack'] }
}

/** Restores the pre-cast state, then casts in the next macrotask so the engine sees a fresh diff. */
function replayCast(base: GameView, cast: (game: GameView) => GameView): () => void {
  return () => {
    setState({ game: base })
    setTimeout(() => {
      const current = getState().game
      if (current) setState({ game: cast(current) })
    }, 0)
  }
}

const QUIET_RESET_GAME_ID = 'gallery-quiet-reset'

/**
 * Like `replayCast`, but the reset itself never animates: the base view arrives under another
 * game id and then under the real one, and the transition engine never diffs views of different
 * games. Needed when undoing the change would itself play an animation (a bounced card entering
 * again, a transformed card flipping back).
 */
function replayQuiet(base: GameView, gameId: string, change: (game: GameView) => GameView): () => void {
  return () => {
    setState({ game: { ...base }, gameId: QUIET_RESET_GAME_ID })
    setTimeout(() => setState({ game: { ...base }, gameId }), 0)
    setTimeout(() => {
      const current = getState().game
      if (current) setState({ game: change(current) })
    }, 60)
  }
}

/** Sets the count of one +1/+1 counter on a permanent, and its P/T with it; the server sends counters as {name, count} pairs. */
function withPlusCounter(game: GameView, id: string, count: number): GameView {
  return mapControlled(game, (p) => {
    const perm = p.battlefield?.[id]
    if (!perm) return p
    const delta = count - (perm.counters ?? []).filter((c) => c.name === '+1/+1').reduce((n, c) => n + (c.count ?? 0), 0)
    const bump = (value: unknown) => String((parseInt(String(value ?? '0'), 10) || 0) + delta)
    return { ...p, battlefield: { ...p.battlefield, [id]: { ...perm, power: bump(perm.power), toughness: bump(perm.toughness), counters: [{ name: '+1/+1', count }] } } }
  })
}

/** Turns one controlled permanent into a planeswalker with the given loyalty; the server sends loyalty as a plain string field. */
function withLoyalty(game: GameView, id: string, loyalty: number): GameView {
  return mapControlled(game, (p) => {
    const perm = p.battlefield?.[id]
    if (!perm) return p
    return { ...p, battlefield: { ...p.battlefield, [id]: { ...perm, cardTypes: ['PLANESWALKER'], counters: [], loyalty: String(loyalty) } } }
  })
}

const GALLERY_BLADE_ID = 'gallery-blade'
const GALLERY_HOST_ID = 'gallery-host'

/** Adds a second creature, a copy of `templateId`, so equipment has somewhere to move. */
function withSecondHost(game: GameView, templateId: string): GameView {
  return mapControlled(game, (p) => {
    const template = p.battlefield?.[templateId]
    if (!template) return p
    return { ...p, battlefield: { ...p.battlefield, [GALLERY_HOST_ID]: { ...template, id: GALLERY_HOST_ID, name: 'Second Host', attachments: [], counters: [] } } }
  })
}

/** Puts a synthetic equipment on the controlled battlefield, attached to `hostId`; the server lists attachments on the host. */
function withEquipmentOn(game: GameView, templateId: string, hostId: string): GameView {
  return mapControlled(game, (p) => {
    const template = p.battlefield?.[templateId]
    if (!template) return p
    const battlefield = { ...p.battlefield }
    for (const [id, perm] of Object.entries(battlefield)) {
      const rest = (perm.attachments ?? []).filter((a) => a !== GALLERY_BLADE_ID)
      if (id === hostId) battlefield[id] = { ...perm, attachments: [...rest, GALLERY_BLADE_ID] }
      else if (rest.length !== (perm.attachments ?? []).length) battlefield[id] = { ...perm, attachments: rest }
    }
    battlefield[GALLERY_BLADE_ID] = {
      ...template,
      id: GALLERY_BLADE_ID,
      name: 'Gallery Blade',
      cardTypes: ['ARTIFACT'],
      subTypes: ['Equipment'],
      counters: [],
      attachments: [],
      attachedTo: hostId,
      power: '',
      toughness: '',
    }
    return { ...p, battlefield }
  })
}

/** Adds a copy of a battlefield card to the controlled graveyard without removing anything, as a mill does. */
function withMilledCard(game: GameView, templateId: string): GameView {
  return mapControlled(game, (p) => {
    const template = p.battlefield?.[templateId]
    if (!template) return p
    return { ...p, graveyard: { ...p.graveyard, 'gallery-milled': { ...template, id: 'gallery-milled', name: 'Milled Card' } } }
  })
}

const COUNTERSPELL_ID = 'gallery-counterspell'
const COUNTERED_ID = 'gallery-countered-bolt'

/** The opponent's Bolt aims at my creature and my Counterspell, on top, targets the Bolt. */
function withCounterspellOnStack(game: GameView, creatureId: string): GameView {
  const me = controlledPlayer(game)
  const opponent = opponentPlayer(game)
  const counterspell = {
    id: COUNTERSPELL_ID,
    name: 'Counterspell',
    displayName: 'Counterspell',
    expansionSetCode: 'MH2',
    cardNumber: '267',
    manaValue: 2,
    cardTypes: ['Instant'],
    rules: ['Counter target spell.'],
    targets: [COUNTERED_ID],
    controllerId: me?.playerId,
    controllerName: me?.name,
  }
  const target = { ...bolt(COUNTERED_ID, opponent), targets: [creatureId] }
  return { ...game, stack: { [COUNTERSPELL_ID]: counterspell, [COUNTERED_ID]: target } as unknown as GameView['stack'] }
}

/** Both leave the stack in one update, each to its controller's graveyard; the creature is untouched. */
function resolveCounterspell(game: GameView): GameView {
  const stack = game.stack ?? {}
  return {
    ...game,
    stack: {} as unknown as GameView['stack'],
    players: players(game).map((p) => {
      const mine = Object.entries(stack).filter(([, spell]) => spell.controllerId === p.playerId).map(([id, spell]) => [cardIdOf(id), { ...spell, id: cardIdOf(id) }])
      return mine.length > 0 ? { ...p, graveyard: { ...p.graveyard, ...Object.fromEntries(mine) } } : p
    }),
  }
}

/** A day/night double-faced creature on the controlled battlefield, on the given face; the server flags the back face with `transformed`. */
function withDelver(game: GameView, templateId: string, transformed: boolean): GameView {
  return mapControlled(game, (p) => {
    const template = p.battlefield?.[templateId]
    if (!template) return p
    const face = transformed
      ? { name: 'Insectile Aberration', displayName: 'Insectile Aberration', power: '3', toughness: '2', abilities: ['Flying'] }
      : { name: 'Delver of Secrets', displayName: 'Delver of Secrets', power: '1', toughness: '1', abilities: [] }
    return {
      ...p,
      battlefield: {
        ...p.battlefield,
        [templateId]: { ...template, ...face, expansionSetCode: 'ISD', cardNumber: '51', manaValue: 1, cardTypes: ['Creature'], transformed, tapped: false, counters: [] },
      },
    }
  })
}

/** Returns a controlled permanent to my hand: it leaves the battlefield and shows up in `myHand`. */
function bounceToMyHand(game: GameView, id: string): GameView {
  const me = controlledPlayer(game)
  const perm = me?.battlefield?.[id]
  if (!me || !perm) return game
  const battlefield = { ...me.battlefield }
  delete battlefield[id]
  return {
    ...game,
    myHand: { ...(game.myHand ?? {}), [id]: perm },
    players: players(game).map((p) => (p === me ? { ...p, battlefield, handCount: (p.handCount ?? 0) + 1 } : p)),
  }
}

/** Returns an opponent's permanent to their hand: only their hand count tells where it went. */
function bounceToOpponentHand(game: GameView, owner: PlayerView | undefined, id: string): GameView {
  if (!owner) return game
  return {
    ...game,
    players: players(game).map((p) => {
      if (p.playerId !== owner.playerId || !p.battlefield?.[id]) return p
      const battlefield = { ...p.battlefield }
      delete battlefield[id]
      return { ...p, battlefield, handCount: (p.handCount ?? 0) + 1 }
    }),
  }
}

function opponentNonLandId(player: PlayerView | undefined): string | undefined {
  return Object.entries(player?.battlefield ?? {})
    .find(([, perm]) => !(perm.cardTypes ?? []).some((t) => String(t).toLowerCase() === 'land'))?.[0]
}

/** The game-log line `PlayerImpl.shuffleLibrary` broadcasts, fed through the real chat handler. */
function announceShuffle(player: PlayerView | undefined): () => void {
  return () => {
    if (!player) return
    const message = `<font color='#20B2AA'>${player.name}</font>'s library is shuffled (source: <font color='#6495ED'>Evolving Wilds</font>)`
    handleChatMessage({ message, messageType: 'GAME', username: '' }, null, getState())
  }
}

/** Feeds one server game-log line through the real chat handler. */
function announce(message: string): () => void {
  return () => handleChatMessage({ message, messageType: 'GAME', username: '' }, null, getState())
}

const logName = (name: string) => `<font color='#20B2AA'>${name}</font>`
const logObject = (id: string, name: string) => `<font color='#B0C4DE' object_id='${id}'>${name}</font> [${id.slice(0, 3)}]`

/** Like `replayQuiet`, plus a log line fed after the reset and before the change (the server sends the line first). */
function replayQuietWithLog(base: GameView, gameId: string, line: () => string, change: (game: GameView) => GameView): () => void {
  return () => {
    setState({ game: { ...base }, gameId: QUIET_RESET_GAME_ID })
    setTimeout(() => setState({ game: { ...base }, gameId }), 0)
    setTimeout(() => announce(line())(), 40)
    setTimeout(() => {
      const current = getState().game
      if (current) setState({ game: change(current) })
    }, 80)
  }
}

function withDesignation(game: GameView, kind: 'monarch' | 'initiative', holderId: string | null): GameView {
  return { ...game, players: players(game).map((p) => ({ ...p, [kind]: p.playerId === holderId })) }
}

function withPhased(game: GameView, id: string, phasedIn: boolean): GameView {
  return mapControlled(game, (p) => {
    const perm = p.battlefield?.[id]
    if (!perm) return p
    return { ...p, battlefield: { ...p.battlefield, [id]: { ...perm, phasedIn } } }
  })
}

function withPermanentOn(game: GameView, playerId: string, id: string): GameView {
  const land = { id, name: 'Forest', displayName: 'Forest', parentId: id, cardTypes: ['Land'], tapped: false, manaValue: 0, expansionSetCode: '', cardNumber: '0' } as unknown as PermanentView
  return { ...game, players: players(game).map((p) => (p.playerId === playerId ? { ...p, battlefield: { ...p.battlefield, [id]: land } } : p)) }
}

function withPlayerOut(game: GameView, playerId: string): GameView {
  return { ...game, players: players(game).map((p) => (p.playerId === playerId ? { ...p, life: 0, hasLeft: true } : p)) }
}

/** A mulligan view: turn 1 with no phase, and the hand dealt under ids tagged with `round`. */
function mulliganHand(game: GameView, round: number): GameView {
  const hand = Object.values(game.myHand ?? {})
  const source = hand.length > 0 ? hand : LIBRARY_CARDS.map((c) => c as unknown as CardView)
  const dealt = Array.from({ length: 7 }, (_, i) => {
    const card = source[i % source.length]
    const id = `gallery-mulligan-${round}-${i}`
    return [id, { ...card, id }] as const
  })
  return { ...coinMulligan(game), myHand: Object.fromEntries(dealt) }
}

const DAY_NIGHT_ID = 'gallery-day-night'

/** The day/night designation: the engine adds its state to a helper emblem's rules. */
function withDayNight(game: GameView, night: boolean): GameView {
  const emblem = { id: DAY_NIGHT_ID, name: night ? 'Night' : 'Day', displayName: night ? 'Night' : 'Day', manaValue: 0, rules: [night ? "It's currently night" : "It's currently day"] }
  return { ...game, myHelperEmblems: { ...(game.myHelperEmblems ?? {}), [DAY_NIGHT_ID]: emblem } as GameView['myHelperEmblems'] }
}

const COPIED_BOLT_ID = 'gallery-copied-bolt'
const BOLT_COPY_ID = 'gallery-bolt-copy'

/** A copy of the Bolt on the stack lands on top of it; no hand changes, so it reads as a copy, not a cast. */
function copyBolt(game: GameView): GameView {
  const original = game.stack?.[COPIED_BOLT_ID]
  if (!original) return game
  return { ...game, stack: { ...(game.stack ?? {}), [BOLT_COPY_ID]: { ...original, id: BOLT_COPY_ID } } as GameView['stack'] }
}

function withRevealed(game: GameView, templateIds: string[], owner: PlayerView | undefined): GameView {
  const cards = Object.fromEntries(templateIds.map((id, i) => {
    const template = owner?.battlefield?.[id]
    const revealedId = `gallery-revealed-${i}`
    return [revealedId, { ...(template ?? { name: 'Forest', manaValue: 0 }), id: revealedId, tapped: false, counters: [] }]
  }))
  return { ...game, revealed: [{ name: 'Gallery Reveal', cards: cards as GameView['myHand'] }] }
}

const COIN_GAME_ID = 'gallery-coin-flip'

/** Pre-game view: turn 0, nobody active, the mulligan already over. */
function coinPregame(game: GameView): GameView {
  return { ...game, turn: 0, activePlayerId: null, activePlayerName: '', players: players(game).map((p) => ({ ...p, isActive: false })) }
}

/** Turn 1 during the mulligan: phase and step are null, nobody is active yet (the server's first turn-1 view). */
function coinMulligan(game: GameView): GameView {
  return { ...game, turn: 1, phase: null, step: null, activePlayerId: null, activePlayerName: '', players: players(game).map((p) => ({ ...p, isActive: false })) }
}

/** Turn 1 upkeep with `who` active: the transition engine flips the coin for that player. */
function coinFirstTurn(game: GameView, who: PlayerView | undefined): GameView {
  return {
    ...game,
    turn: 1,
    phase: 'BEGINNING',
    step: 'UPKEEP',
    activePlayerId: who?.playerId ?? null,
    activePlayerName: who?.name ?? '',
    players: players(game).map((p) => ({ ...p, isActive: p === who })),
  }
}

/** Re-arms the coin for this game, then feeds the pre-game, mulligan and first-turn views in order. */
function replayCoinFlip(pregame: GameView, mulligan: GameView, firstTurn: GameView): () => void {
  return () => {
    forgetCoinFlip(COIN_GAME_ID)
    // Copies: the engine skips a view it already holds, and the store may hold these objects itself.
    setState({ game: { ...pregame } })
    setTimeout(() => setState({ game: { ...mulligan } }), 0)
    setTimeout(() => setState({ game: { ...firstTurn } }), 600)
  }
}

/** Mueve la primera instantánea de la mano a la pila, con controller = yo. */
function castFirstInstant(game: GameView): GameView {
  const me = controlledPlayer(game)
  const taken = removeFromHand(game, isType('instant'))
  if (!me || !taken) return game
  return {
    ...game,
    myHand: taken.hand,
    stack: { ...(game.stack ?? {}), [taken.id]: { ...taken.card, controllerId: me.playerId, controllerName: me.name } },
    players: players(game).map((p) => (p === me ? { ...p, handCount: Math.max(0, (p.handCount ?? 0) - 1) } : p)),
  }
}

const CREATURE_STACK_ID = 'gallery-creature-stack'

/** Puts a creature spell on the stack for the given controller; it resolves onto the battlefield under its card id. */
function withCreatureOnStack(game: GameView, owner: PlayerView | undefined, extra: Partial<CardView> = {}): GameView {
  const creature: CardView = {
    id: CREATURE_STACK_ID,
    name: 'Elvish Mystic',
    displayName: 'Elvish Mystic',
    expansionSetCode: 'M14',
    cardNumber: '169',
    manaValue: 1,
    cardTypes: ['Creature'],
    controllerId: owner?.playerId,
    controllerName: owner?.name,
    ...extra,
  }
  return { ...game, stack: { ...(game.stack ?? {}), [CREATURE_STACK_ID]: creature } }
}

/** Resolves the creature spell: it leaves the stack and enters its controller's battlefield as the permanent of its card. */
function resolveCreatureSpell(game: GameView): GameView {
  const spell = game.stack?.[CREATURE_STACK_ID]
  if (!spell) return game
  const stack = { ...game.stack }
  delete stack[CREATURE_STACK_ID]
  return {
    ...game,
    stack,
    players: players(game).map((p) => (p.playerId === spell.controllerId
      ? { ...p, battlefield: { ...p.battlefield, [cardIdOf(CREATURE_STACK_ID)]: { ...spell, id: cardIdOf(CREATURE_STACK_ID), tapped: false } } }
      : p)),
  }
}

/** Replaces one of my permanents with another card, keeping its id and slot. */
function withMyPermanent(game: GameView, id: string, card: Partial<PermanentView>): GameView {
  return mapControlled(game, (p) => {
    const perm = p.battlefield?.[id]
    if (!perm) return p
    return { ...p, battlefield: { ...p.battlefield, [id]: { ...perm, counters: [], attachments: [], ...card, id } } }
  })
}

const TREETOP_VILLAGE: Partial<PermanentView> = {
  name: 'Treetop Village',
  displayName: 'Treetop Village',
  expansionSetCode: 'ULG',
  cardNumber: '143',
  cardTypes: ['LAND'],
  subTypes: [],
  power: '0',
  toughness: '0',
  color: { white: false, blue: false, black: false, red: false, green: false },
  rules: ['Treetop Village enters the battlefield tapped.', '{T}: Add {G}.', '{1}{G}: Treetop Village becomes a 3/3 green Ape creature with trample until end of turn. It\'s still a land.'],
  tapped: false,
}

/** A manland activated (or the effect wearing off at end of turn): the server adds or drops CREATURE, its P/T and its creature types. */
function withAnimatedLand(game: GameView, id: string, animated: boolean): GameView {
  return withMyPermanent(game, id, animated
    ? { ...TREETOP_VILLAGE, cardTypes: ['LAND', 'CREATURE'], subTypes: ['APE'], power: '3', toughness: '3', color: { white: false, blue: false, black: false, red: false, green: true } }
    : TREETOP_VILLAGE)
}

const GALLERY_VEHICLE_ID = 'gallery-vehicle'

const SMUGGLERS_COPTER: Partial<PermanentView> = {
  name: "Smuggler's Copter",
  displayName: "Smuggler's Copter",
  expansionSetCode: 'KLD',
  cardNumber: '235',
  manaValue: 2,
  rarity: 'RARE',
  cardTypes: ['ARTIFACT'],
  subTypes: ['VEHICLE'],
  superTypes: [],
  color: { white: false, blue: false, black: false, red: false, green: false },
  power: '3',
  toughness: '3',
  rules: ['Flying', 'Whenever Smuggler\'s Copter attacks or blocks, you may draw a card. If you do, discard a card.', 'Crew 1'],
  tapped: false,
  summoningSickness: false,
}

/** A vehicle on my battlefield, next to the creature that can crew it. */
function withVehicle(game: GameView, templateId: string): GameView {
  return mapControlled(game, (p) => {
    const template = p.battlefield?.[templateId]
    if (!template) return p
    return { ...p, battlefield: { ...p.battlefield, [GALLERY_VEHICLE_ID]: { ...template, counters: [], attachments: [], ...SMUGGLERS_COPTER, id: GALLERY_VEHICLE_ID } } }
  })
}

/** Crew 1: the crew taps and the vehicle becomes an artifact creature until end of turn. */
function crewVehicle(game: GameView, crewId: string): GameView {
  return mapControlled(game, (p) => {
    const vehicle = p.battlefield?.[GALLERY_VEHICLE_ID]
    const crew = p.battlefield?.[crewId]
    if (!vehicle || !crew) return p
    return { ...p, battlefield: { ...p.battlefield, [crewId]: { ...crew, tapped: true }, [GALLERY_VEHICLE_ID]: { ...vehicle, cardTypes: ['ARTIFACT', 'CREATURE'] } } }
  })
}

const GALLERY_EMBLEM_ID = 'gallery-emblem'

/** The emblem as the server sends it in `commandList` (an `EmblemView`: no mageObjectType, no card types), from the recorded frame. */
function galleryEmblem(): Record<string, unknown> {
  const recorded = (EMBLEM_FRAME?.gameView.players ?? []).flatMap((p) => (p.commandList ?? []) as Array<Record<string, unknown>>).find((c) => String(c.name ?? '').startsWith('Emblem'))
  return { ...(recorded ?? { name: 'Emblem Gideon', expansionSetCode: 'AKH', cardNumber: '', rules: ["As long as you control a Gideon planeswalker, you can't lose the game and your opponents can't win the game."] }), id: GALLERY_EMBLEM_ID }
}

function withMyCommandItem(game: GameView, item: Record<string, unknown>): GameView {
  return mapControlled(game, (p) => ({ ...p, commandList: [...((p.commandList ?? []) as unknown[]).filter((c) => (c as { id?: string }).id !== item.id), item] }))
}

const GALLERY_DUNGEON_ID = 'gallery-dungeon'

/** Lost Mine of Phandelver as the server sends it (a `DungeonView`), from the recorded frame, with the venture in `room`. */
function galleryDungeon(room: string): Record<string, unknown> {
  const recorded = (DUNGEON_FRAME?.gameView.players ?? []).flatMap((p) => (p.commandList ?? []) as Array<Record<string, unknown>>).find((c) => String(c.name ?? '').includes('Phandelver'))
  const rules = ((recorded?.rules as string[] | undefined) ?? ['<i>(Currently in Goblin Lair)</i>'])
    .map((line) => line.replace(/\(Currently in [^)]+\)/, `(Currently in ${room})`))
  return { ...(recorded ?? { name: 'Lost Mine of Phandelver', expansionSetCode: 'AFR' }), id: GALLERY_DUNGEON_ID, rules }
}

/** A plane as the server sends it (a `PlaneView`): it is universal, so every player's command list carries it. */
function withPlane(game: GameView, id: string, name: string, rules: string[]): GameView {
  const plane = { id, name, imageFileName: '', imageNumber: 0, expansionSetCode: 'PCA', rules }
  return {
    ...game,
    players: players(game).map((p) => ({
      ...p,
      commandList: [...((p.commandList ?? []) as Array<{ name?: string }>).filter((c) => !String(c.name ?? '').startsWith('Plane - ')), plane],
    })),
  }
}

const AKOUM = ['Players may cast enchantment spells as though they had flash.', 'Whenever chaos ensues, destroy target creature that isn\'t enchanted.']
const TOLARIA_WEST = ['When you planeswalk to Academy at Tolaria West, discard your hand, then draw seven cards.', 'Whenever chaos ensues, discard your hand.']

/** Cards an opponent let me watch in their hand (`watchedHands`, keyed by player name): `SimpleCardView`s, a printing and no name. */
function withWatchedHand(game: GameView, owner: PlayerView | undefined): GameView {
  if (!owner) return game
  const printings = [['M10', '146'], ['MH2', '267'], ['M14', '169']]
  const hand = Object.fromEntries(printings.map(([set, num], i) => {
    const id = `gallery-watched-${i}`
    return [id, { id, expansionSetCode: set, cardNumber: num, usesVariousArt: false, gameObject: false }]
  }))
  return { ...game, watchedHands: { ...(game.watchedHands ?? {}), [owner.name]: hand } as GameView['watchedHands'] }
}

const BUSHI_TENDERFOOT: Partial<PermanentView> = {
  name: 'Bushi Tenderfoot',
  displayName: 'Bushi Tenderfoot',
  expansionSetCode: 'CHK',
  cardNumber: '2',
  cardTypes: ['CREATURE'],
  subTypes: ['HUMAN', 'SOLDIER'],
  color: { white: true, blue: false, black: false, red: false, green: false },
  power: '1',
  toughness: '1',
  flipped: false,
  rules: ['When a creature dealt damage by Bushi Tenderfoot this turn dies, flip Bushi Tenderfoot.'],
}

/** A Kamigawa flip card on its unflipped side or flipped: the server keeps the id and sends `flipped` with the other half's name and P/T. */
function withFlipCard(game: GameView, id: string, flipped: boolean): GameView {
  return withMyPermanent(game, id, flipped
    ? { ...BUSHI_TENDERFOOT, name: 'Kenzo the Hardhearted', displayName: 'Kenzo the Hardhearted', superTypes: ['LEGENDARY'], subTypes: ['HUMAN', 'SAMURAI'], power: '3', toughness: '4', flipped: true, rules: ['Double strike; bushido 2'] }
    : BUSHI_TENDERFOOT)
}

/** Mueve la primera tierra de la mano al campo del jugador controlado. */
function playFirstLand(game: GameView): GameView {
  const me = controlledPlayer(game)
  const taken = removeFromHand(game, isType('land'))
  if (!me || !taken) return game
  return {
    ...game,
    myHand: taken.hand,
    players: players(game).map((p) => (p === me
      ? { ...p, handCount: Math.max(0, (p.handCount ?? 0) - 1), battlefield: { ...p.battlefield, [taken.id]: { ...taken.card, tapped: false } } }
      : p)),
  }
}

/** Like `replayQuiet`, plus a second change `secondAtMs` after the press (a cast, then its resolution). */
function replayQuietThen(base: GameView, gameId: string, first: (game: GameView) => GameView, second: (game: GameView) => GameView, secondAtMs: number): () => void {
  const replay = replayQuiet(base, gameId, first)
  return () => {
    replay()
    setTimeout(() => {
      const current = getState().game
      if (current) setState({ game: second(current) })
    }, secondAtMs)
  }
}

function withStep(game: GameView, phase: string, step: string): GameView {
  return { ...game, phase, step }
}

/** The controlled player holds priority, so their own timer is the one that ticks. */
function withMyPriority(game: GameView): GameView {
  const me = controlledPlayer(game)
  if (!me) return game
  return { ...game, priorityPlayerName: me.name, players: players(game).map((p) => ({ ...p, hasPriority: p === me })) }
}

function withMyTimer(game: GameView, seconds: number): GameView {
  return mapControlled(game, (p) => ({ ...p, priorityTimeLeftSecs: seconds, timerActive: true }))
}

function untapPermanent(game: GameView, id: string): GameView {
  return mapControlled(game, (p) => {
    const perm = p.battlefield?.[id]
    if (!perm) return p
    return { ...p, battlefield: { ...p.battlefield, [id]: { ...perm, tapped: false } } }
  })
}

/** Declares `id` as an attacker against the opponent: it taps and joins a combat group, the only source of the `attacking` class. */
function declareAttacker(game: GameView, id: string): GameView {
  const opponent = opponentPlayer(game)
  const tapped = mapControlled(game, (p) => {
    const perm = p.battlefield?.[id]
    if (!perm) return p
    return { ...p, battlefield: { ...p.battlefield, [id]: { ...perm, tapped: true } } }
  })
  const group = { attackers: { [id]: {} }, blockers: {}, isBlocked: false, defenderId: opponent?.playerId, defenderName: opponent?.name }
  return { ...withStep(tapped, 'COMBAT', 'DECLARE_ATTACKERS'), combat: [group] as unknown as GameView['combat'] }
}

const GALLERY_OPP_ATTACKER_ID = 'gallery-opp-attacker'
const GALLERY_PAID_SPELL_ID = 'gallery-paid-spell'

/** Gives a player's pool the given mana; the server sends the pool as six counters. */
function withManaPool(game: GameView, pool: Partial<PlayerView['manaPool']>): GameView {
  return mapControlled(game, (p) => ({ ...p, manaPool: { red: 0, green: 0, blue: 0, white: 0, black: 0, colorless: 0, ...pool } }))
}

/** Casts a spell paid from the pool: it joins the stack and the pool empties in the same view. */
function castPaidFromPool(game: GameView): GameView {
  const me = controlledPlayer(game)
  const spell = { ...bolt(GALLERY_PAID_SPELL_ID, me), name: 'Lightning Bolt' }
  return { ...withManaPool(game, {}), stack: { ...(game.stack ?? {}), [GALLERY_PAID_SPELL_ID]: spell } as GameView['stack'] }
}

/** Sets the library size of one player. */
function withLibraryCount(game: GameView, playerId: string | undefined, libraryCount: number): GameView {
  return { ...game, players: players(game).map((p) => (p.playerId === playerId ? { ...p, libraryCount } : p)) }
}

/** Replaces the card icons of one of my permanents; the server sends them as `{cardIconType, text, hint}`. */
function withCardIcons(game: GameView, id: string, cardIcons: Array<{ cardIconType: string; text: string; hint: string }>): GameView {
  return mapControlled(game, (p) => {
    const perm = p.battlefield?.[id]
    if (!perm) return p
    return { ...p, battlefield: { ...p.battlefield, [id]: { ...perm, cardIcons } } }
  })
}

/** Replaces the `rules` of one of my permanents (designation hints live there). */
function withRules(game: GameView, id: string, rules: string[]): GameView {
  return mapControlled(game, (p) => {
    const perm = p.battlefield?.[id]
    if (!perm) return p
    return { ...p, battlefield: { ...p.battlefield, [id]: { ...perm, rules } } }
  })
}

/** The opponent attacks with a copy of one of my creatures; nothing has blocked yet. */
function withOpponentAttacker(game: GameView, templateId: string): GameView {
  const me = controlledPlayer(game)
  const opponent = opponentPlayer(game)
  const template = me?.battlefield?.[templateId]
  if (!me || !opponent || !template) return game
  const attacker = { ...template, id: GALLERY_OPP_ATTACKER_ID, name: 'Raging Goblin', displayName: 'Raging Goblin', tapped: true, counters: [] }
  const group = { attackers: { [GALLERY_OPP_ATTACKER_ID]: {} }, blockers: {}, isBlocked: false, defenderId: me.playerId, defenderName: me.name }
  return {
    ...withStep(game, 'COMBAT', 'DECLARE_ATTACKERS'),
    players: players(game).map((p) => (p === opponent ? { ...p, battlefield: { ...p.battlefield, [GALLERY_OPP_ATTACKER_ID]: attacker } } : p)) as PlayerView[],
    combat: [group] as unknown as GameView['combat'],
  }
}

/** A permanent joins the blockers of every combat group, as the declare-blockers step does. */
function declareBlocker(game: GameView, id: string): GameView {
  const groups = (game.combat ?? []) as unknown as Array<Record<string, unknown>>
  return {
    ...withStep(game, 'COMBAT', 'DECLARE_BLOCKERS'),
    combat: groups.map((g) => ({ ...g, blockers: { ...((g.blockers ?? {}) as Record<string, unknown>), [id]: {} }, isBlocked: true })) as unknown as GameView['combat'],
  }
}

const GALLERY_ATTACKER_ID = 'gallery-attacker'

/** The recorded block (my Elvish Mystic into theirs) plus an unblocked Grizzly Bears of mine attacking the opponent. */
function withTwoAttackers(game: GameView): GameView {
  const opponent = opponentPlayer(game)
  const bears = {
    id: GALLERY_ATTACKER_ID,
    name: 'Grizzly Bears',
    displayName: 'Grizzly Bears',
    expansionSetCode: 'IMA',
    cardNumber: '165',
    manaValue: 2,
    cardTypes: ['Creature'],
    subtypes: ['Bear'],
    power: '2',
    toughness: '2',
    tapped: true,
  }
  const withBears = mapControlled(game, (p) => ({ ...p, battlefield: { ...p.battlefield, [GALLERY_ATTACKER_ID]: bears } }))
  const unblocked = { attackers: { [GALLERY_ATTACKER_ID]: {} }, blockers: {}, isBlocked: false, defenderId: opponent?.playerId, defenderName: opponent?.name }
  return { ...withBears, combat: [...(game.combat ?? []), unblocked] as unknown as GameView['combat'] }
}

/**
 * The combat damage step: every attacker and blocker in a group with a blocker dies (two 1/1 Mystics trade),
 * and the opponent loses what the unblocked attackers deal. Only the unblocked groups stay in combat.
 */
function dealCombatDamage(game: GameView): GameView {
  const groups = (game.combat ?? []) as unknown as Array<Record<string, unknown>>
  const ids = (value: unknown) => Object.keys((value ?? {}) as Record<string, unknown>)
  const traded = new Set(groups.filter((g) => ids(g.blockers).length > 0).flatMap((g) => [...ids(g.attackers), ...ids(g.blockers)]))
  const unblocked = groups.filter((g) => ids(g.blockers).length === 0)
  const damage = unblocked.reduce((sum, g) => sum + ids(g.attackers).reduce((n, id) => {
    const perm = players(game).map((p) => p.battlefield?.[id]).find(Boolean)
    return n + (parseInt(String(perm?.power ?? '0'), 10) || 0)
  }, 0), 0)
  const defenderId = unblocked.map((g) => g.defenderId).find((id): id is string => typeof id === 'string')
  return {
    ...withStep(game, 'COMBAT', 'COMBAT_DAMAGE'),
    combat: unblocked as unknown as GameView['combat'],
    players: players(game).map((p) => {
      const dying = Object.keys(p.battlefield ?? {}).filter((id) => traded.has(id))
      const battlefield = { ...p.battlefield }
      const graveyard = { ...p.graveyard }
      for (const id of dying) {
        graveyard[id] = battlefield[id]
        delete battlefield[id]
      }
      return { ...p, battlefield, graveyard, life: p.playerId === defenderId ? (p.life ?? 0) - damage : p.life }
    }),
  }
}

const KWFX_KNIGHT_ID = 'gallery-kwfx-knight'
const KWFX_RATS_ID = 'gallery-kwfx-rats'
const KWFX_DEATHTOUCH_BLOCKER_ID = 'gallery-kwfx-dreadmaw-opp'
const KWFX_DREADMAW_ID = 'gallery-kwfx-dreadmaw'
const KWFX_BEARS_ID = 'gallery-kwfx-bears'
const KWFX_CHILD_ID = 'gallery-kwfx-child'
const KWFX_MYR_ID = 'gallery-kwfx-myr'
const KWFX_BLOCKING_RATS_ID = 'gallery-kwfx-rats-opp'
const KWFX_VIPER_ID = 'gallery-kwfx-viper'
const KWFX_BEARS_OPP_1_ID = 'gallery-kwfx-bears-opp-1'
const KWFX_BEARS_OPP_2_ID = 'gallery-kwfx-bears-opp-2'
const KWFX_WALKER_ID = 'gallery-kwfx-walker'

interface KwFxCard {
  name: string
  power: string
  toughness: string
  manaValue: number
  subtypes: string[]
  rules: string[]
  cardIcons?: Array<{ cardIconType?: string }>
}

const KWFX_KNIGHT: KwFxCard = {
  name: 'White Knight',
  power: '2',
  toughness: '2',
  manaValue: 2,
  subtypes: ['Human', 'Knight'],
  rules: ['First strike, protection from black'],
  cardIcons: [{ cardIconType: 'ABILITY_FIRST_STRIKE' }],
}

const KWFX_BEARS: KwFxCard = { name: 'Grizzly Bears', power: '2', toughness: '2', manaValue: 2, subtypes: ['Bear'], rules: [] }

const KWFX_VIPER: KwFxCard = { name: 'Deadly Viper', power: '3', toughness: '3', manaValue: 3, subtypes: ['Snake'], rules: ['Deathtouch'] }

function kwFxPermanent(id: string, card: KwFxCard, tapped: boolean): PermanentView {
  return {
    id,
    name: card.name,
    displayName: card.name,
    manaValue: card.manaValue,
    cardTypes: ['Creature'],
    subTypes: card.subtypes,
    power: card.power,
    toughness: card.toughness,
    tapped,
    summoningSickness: false,
    rules: card.rules,
    cardIcons: card.cardIcons,
  }
}

function kwFxWalker(id: string, loyalty: string): PermanentView {
  return {
    id,
    name: 'Ember Oracle',
    displayName: 'Ember Oracle',
    manaValue: 4,
    cardTypes: ['Planeswalker'],
    subTypes: ['Oracle'],
    loyalty,
    tapped: false,
    summoningSickness: false,
    rules: [],
  }
}

function kwFxCombat(game: GameView, attackers: string[], blockers: string[]): Record<string, unknown> {
  const opponent = opponentPlayer(game)
  return {
    attackers: Object.fromEntries(attackers.map((id) => [id, {}])),
    blockers: Object.fromEntries(blockers.map((id) => [id, {}])),
    isBlocked: blockers.length > 0,
    defenderId: opponent?.playerId,
    defenderName: opponent?.name,
  }
}

/** The declare-blockers step with one combat group only, my creatures on my battlefield and theirs on the opponent's. */
function kwFxBase(
  game: GameView,
  group: Record<string, unknown>,
  mine: Record<string, PermanentView>,
  theirs: Record<string, PermanentView>,
): GameView {
  const withMine = mapControlled(game, (p) => ({ ...p, battlefield: { ...p.battlefield, ...mine } }))
  const withBoth = mapOpponent(withMine, (p) => ({ ...p, battlefield: { ...p.battlefield, ...theirs } }))
  return { ...withStep(withBoth, 'COMBAT', 'DECLARE_BLOCKERS'), combat: [group] as unknown as GameView['combat'] }
}

/** Moves the given permanents, whoever controls them, to their owners' graveyards. */
function toGraveyards(game: GameView, ids: string[]): GameView {
  return {
    ...game,
    players: players(game).map((p) => {
      const battlefield = { ...p.battlefield }
      const graveyard = { ...p.graveyard }
      for (const id of ids) {
        if (battlefield[id]) {
          graveyard[id] = battlefield[id]
          delete battlefield[id]
        }
      }
      return { ...p, battlefield, graveyard }
    }),
  }
}

function withLifeDelta(game: GameView, owner: 'me' | 'opponent', delta: number): GameView {
  const change = (p: PlayerView) => ({ ...p, life: (p.life ?? 0) + delta })
  return owner === 'me' ? mapControlled(game, change) : mapOpponent(game, change)
}

function sendToExile(game: GameView, id: string): GameView {
  return mapControlled(game, (p) => {
    const perm = p.battlefield?.[id]
    if (!perm) return p
    const battlefield = { ...p.battlefield }
    delete battlefield[id]
    return { ...p, battlefield, exile: { ...p.exile, [id]: perm } }
  })
}

/** Returns a card of my graveyard to the battlefield under the same id, as Reanimate does. */
function returnFromGraveyard(game: GameView, id: string): GameView {
  return mapControlled(game, (p) => {
    const card = p.graveyard?.[id]
    if (!card) return p
    const graveyard = { ...p.graveyard }
    delete graveyard[id]
    return { ...p, graveyard, battlefield: { ...p.battlefield, [id]: { ...card, tapped: false, damage: 0 } } }
  })
}

/** Discards the first card of my hand: it leaves `myHand` and lands in my graveyard under the same id. */
function discardFirstCard(game: GameView): GameView {
  const me = controlledPlayer(game)
  const taken = removeFromHand(game, () => true)
  if (!me || !taken) return game
  return {
    ...game,
    myHand: taken.hand,
    players: players(game).map((p) => (p === me
      ? { ...p, handCount: Math.max(0, (p.handCount ?? 0) - 1), graveyard: { ...p.graveyard, [taken.id]: taken.card } }
      : p)),
  }
}

/** Sets a controlled permanent's power and toughness, as a pump or a shrink until end of turn does (no counters). */
function withPt(game: GameView, id: string, power: number, toughness: number): GameView {
  return mapControlled(game, (p) => {
    const perm = p.battlefield?.[id]
    if (!perm) return p
    return { ...p, battlefield: { ...p.battlefield, [id]: { ...perm, power: String(power), toughness: String(toughness), counters: [] } } }
  })
}

function ptOf(game: GameView, id: string): { power: number; toughness: number } {
  const perm = controlledPlayer(game)?.battlefield?.[id]
  return { power: parseInt(String(perm?.power ?? '1'), 10) || 1, toughness: parseInt(String(perm?.toughness ?? '1'), 10) || 1 }
}

/** Returns a card of my graveyard to my hand under the same id, as Regrowth does. */
function returnGraveyardToHand(game: GameView, id: string): GameView {
  const me = controlledPlayer(game)
  const card = me?.graveyard?.[id]
  if (!me || !card) return game
  const graveyard = { ...me.graveyard }
  delete graveyard[id]
  return {
    ...game,
    myHand: { ...(game.myHand ?? {}), [id]: { ...card, tapped: false } as CardView },
    players: players(game).map((p) => (p === me ? { ...p, graveyard, handCount: (p.handCount ?? 0) + 1 } : p)),
  }
}

const OPP_GRAVE_ID = 'gallery-opp-grave'

function withOpponentGraveyardCard(game: GameView, owner: PlayerView | undefined): GameView {
  if (!owner) return game
  const card = { id: OPP_GRAVE_ID, name: 'Grizzly Bears', displayName: 'Grizzly Bears', expansionSetCode: 'IMA', cardNumber: '165', manaValue: 2, cardTypes: ['Creature'], power: '2', toughness: '2' }
  return { ...game, players: players(game).map((p) => (p.playerId === owner.playerId ? { ...p, graveyard: { ...p.graveyard, [OPP_GRAVE_ID]: card } } : p)) }
}

/** The opponent takes a card of their graveyard back: it leaves the graveyard and only their hand count grows. */
function opponentRegrowth(game: GameView, owner: PlayerView | undefined): GameView {
  if (!owner) return game
  return {
    ...game,
    players: players(game).map((p) => {
      if (p.playerId !== owner.playerId || !p.graveyard?.[OPP_GRAVE_ID]) return p
      const graveyard = { ...p.graveyard }
      delete graveyard[OPP_GRAVE_ID]
      return { ...p, graveyard, handCount: (p.handCount ?? 0) + 1 }
    }),
  }
}

/** Exiles the first card of my hand: it leaves `myHand` and lands in my exile under the same id. */
function exileFirstHandCard(game: GameView): GameView {
  const me = controlledPlayer(game)
  const taken = removeFromHand(game, () => true)
  if (!me || !taken) return game
  return {
    ...game,
    myHand: taken.hand,
    players: players(game).map((p) => (p === me
      ? { ...p, handCount: Math.max(0, (p.handCount ?? 0) - 1), exile: { ...p.exile, [taken.id]: taken.card } }
      : p)),
  }
}

const DELVE_IDS = ['gallery-delve-0', 'gallery-delve-1', 'gallery-delve-2']

function withDelveGraveyard(game: GameView): GameView {
  return mapControlled(game, (p) => ({
    ...p,
    graveyard: {
      ...p.graveyard,
      ...Object.fromEntries(DELVE_IDS.map((id, i) => [id, { ...(LIBRARY_CARDS[i] as unknown as CardView), id, manaValue: 0 }])),
    },
  }))
}

/** Delve: three cards of my graveyard go to exile in one update. */
function delveThree(game: GameView): GameView {
  return mapControlled(game, (p) => {
    const graveyard = { ...p.graveyard }
    const exiled: Record<string, CardView> = {}
    for (const id of DELVE_IDS) {
      if (!graveyard[id]) continue
      exiled[id] = graveyard[id]
      delete graveyard[id]
    }
    return { ...p, graveyard, exile: { ...p.exile, ...exiled } }
  })
}

const IMPULSE_ID = 'gallery-impulse'

/** Impulse draw: the top card of my library goes to exile. */
function exileTopOfLibrary(game: GameView): GameView {
  return mapControlled(game, (p) => ({
    ...p,
    libraryCount: Math.max(0, (p.libraryCount ?? 0) - 1),
    exile: { ...p.exile, [IMPULSE_ID]: { ...(LIBRARY_CARDS[2] as unknown as CardView), id: IMPULSE_ID, manaValue: 1 } },
  }))
}

const FLASHBACK_ID = 'gallery-flashback'

function faithlessLooting(id: string, owner: PlayerView | undefined): CardView {
  return {
    id,
    name: 'Faithless Looting',
    displayName: 'Faithless Looting',
    expansionSetCode: 'PIDW',
    cardNumber: '2',
    manaValue: 1,
    cardTypes: ['Sorcery'],
    rules: ['Draw two cards, then discard two cards.', 'Flashback {2}{R}'],
    controllerId: owner?.playerId,
    controllerName: owner?.name,
  }
}

function withInPile(game: GameView, pile: 'graveyard' | 'exile', card: CardView): GameView {
  return mapControlled(game, (p) => ({ ...p, [pile]: { ...p[pile], [card.id ?? '']: card } }))
}

/** Casts a card out of my graveyard or exile: it leaves the pile and goes on the stack under the same id. */
function castFromMyPile(game: GameView, pile: 'graveyard' | 'exile', id: string): GameView {
  const me = controlledPlayer(game)
  const card = me?.[pile]?.[id]
  if (!me || !card) return game
  const rest = { ...me[pile] }
  delete rest[id]
  return {
    ...game,
    stack: { ...(game.stack ?? {}), [id]: { ...card, controllerId: me.playerId, controllerName: me.name } } as GameView['stack'],
    players: players(game).map((p) => (p === me ? { ...p, [pile]: rest } : p)),
  }
}

const GALLERY_FADING_TOKEN_ID = 'gallery-fading-token'

function withFadingToken(game: GameView): GameView {
  const token = { id: GALLERY_FADING_TOKEN_ID, name: 'Spirit', displayName: 'Spirit', manaValue: 0, cardTypes: ['Creature'], subtypes: ['Spirit'], power: '1', toughness: '1', isToken: true, tapped: false }
  return mapControlled(game, (p) => ({ ...p, battlefield: { ...p.battlefield, [GALLERY_FADING_TOKEN_ID]: token } }))
}

/** The permanent ceases to exist: it leaves the battlefield for no zone the client can see. */
function removeFromBattlefield(game: GameView, id: string): GameView {
  return mapControlled(game, (p) => {
    if (!p.battlefield?.[id]) return p
    const battlefield = { ...p.battlefield }
    delete battlefield[id]
    return { ...p, battlefield }
  })
}

const HEAVY_SPELL_ID = 'gallery-heavy-spell'

function withHeavySpellInHand(game: GameView): GameView {
  const me = controlledPlayer(game)
  const spell: CardView = {
    id: HEAVY_SPELL_ID,
    name: 'Cruel Ultimatum',
    displayName: 'Cruel Ultimatum',
    manaValue: 7,
    rarity: 'RARE',
    cardTypes: ['Sorcery'],
    manaCostLeftStr: ['{U}', '{U}', '{B}', '{B}', '{B}', '{R}', '{R}'],
    rules: ['Target opponent sacrifices a creature, discards three cards, then loses 5 life. You return a creature card from your graveyard to your hand, draw three cards, then gain 5 life.'],
  }
  return {
    ...game,
    myHand: { ...(game.myHand ?? {}), [HEAVY_SPELL_ID]: spell },
    players: players(game).map((p) => (p === me ? { ...p, handCount: (p.handCount ?? 0) + 1 } : p)),
  }
}

function castHeavySpell(game: GameView): GameView {
  const me = controlledPlayer(game)
  const taken = removeFromHand(game, (card) => card.id === HEAVY_SPELL_ID)
  if (!me || !taken) return game
  return {
    ...game,
    myHand: taken.hand,
    stack: { [HEAVY_SPELL_ID]: { ...taken.card, controllerId: me.playerId, controllerName: me.name } } as GameView['stack'],
    players: players(game).map((p) => (p === me ? { ...p, handCount: Math.max(0, (p.handCount ?? 0) - 1) } : p)),
  }
}

function resolveHeavySpell(game: GameView): GameView {
  const spell = game.stack?.[HEAVY_SPELL_ID]
  if (!spell) return game
  return {
    ...game,
    stack: {} as GameView['stack'],
    players: players(game).map((p) => (p.playerId === spell.controllerId ? { ...p, graveyard: { ...p.graveyard, [cardIdOf(HEAVY_SPELL_ID)]: { ...spell, id: cardIdOf(HEAVY_SPELL_ID) } } } : p)),
  }
}

const WRATH_ID = 'gallery-wrath'
const isLandPerm = (perm: CardView) => (perm.cardTypes ?? []).some((t) => String(t).toLowerCase() === 'land')

/** A Grizzly Bears on every player's battlefield, so a 1v1 board has enough creatures for a wipe. */
function withWipeCrowd(game: GameView): GameView {
  return {
    ...game,
    players: players(game).map((p) => {
      const id = `gallery-wipe-${p.playerId}`
      const bears = { id, name: 'Grizzly Bears', displayName: 'Grizzly Bears', expansionSetCode: 'J21', cardNumber: '580', manaValue: 2, cardTypes: ['Creature'], subTypes: ['Bear'], power: '2', toughness: '2', tapped: false, controllerId: p.playerId } as PermanentView
      return { ...p, battlefield: { ...p.battlefield, [id]: bears } }
    }),
  }
}

/** Wrath of God on the stack, cast by the controlled player. */
function withWrathOnStack(game: GameView): GameView {
  const me = controlledPlayer(game)
  const wrath: CardView = {
    id: WRATH_ID,
    name: 'Wrath of God',
    displayName: 'Wrath of God',
    manaValue: 4,
    rarity: 'RARE',
    cardTypes: ['Sorcery'],
    manaCostLeftStr: ['{2}', '{W}', '{W}'],
    color: { white: true },
    rules: ["Destroy all creatures. They can't be regenerated."],
    controllerId: me?.playerId,
    controllerName: me?.name,
  }
  return { ...game, stack: { [WRATH_ID]: wrath } as GameView['stack'] }
}

/** Wrath of God resolves: every creature on every battlefield goes to its graveyard (a token simply vanishes), and the Wrath follows. */
function resolveWrath(game: GameView): GameView {
  const wrath = game.stack?.[WRATH_ID]
  return {
    ...game,
    stack: {} as GameView['stack'],
    players: players(game).map((p) => {
      const battlefield: Record<string, PermanentView> = {}
      const graveyard = { ...p.graveyard }
      for (const [id, perm] of Object.entries(p.battlefield ?? {})) {
        if (isLandPerm(perm)) battlefield[id] = perm
        else if (perm.isToken !== true) graveyard[id] = perm
      }
      if (wrath && p.playerId === wrath.controllerId) graveyard[WRATH_ID] = wrath
      return { ...p, battlefield, graveyard }
    }),
  }
}

type GalleryFaceDown = 'morph' | 'manifest'

const FACE_DOWN_ID = 'gallery-face-down'
const FACE_DOWN: Record<GalleryFaceDown, { prefix: string; image: string; rules: string[]; face: Partial<CardView> & { name: string } }> = {
  morph: {
    prefix: 'Morph',
    image: 'Morph',
    rules: ['{this} becomes a 2/2 face-down creature, with no text, no name, no subtypes, and no mana cost.', 'Turn it face up any time for its morph cost.'],
    face: { name: 'Den Protector', expansionSetCode: 'C16', cardNumber: '147', power: '2', toughness: '1', manaValue: 2, rarity: 'RARE', color: { green: true }, subTypes: ['Human', 'Warrior'] },
  },
  manifest: {
    prefix: 'Manifest',
    image: 'Manifest',
    rules: ['Turn it face up any time for its mana cost if it is a creature card.'],
    face: { name: 'Elite Vanguard', expansionSetCode: 'EMA', cardNumber: '8', power: '2', toughness: '1', manaValue: 1, rarity: 'UNCOMMON', color: { white: true }, subTypes: ['Human', 'Soldier'] },
  },
}

/** A face-down 2/2 on the controlled battlefield, shaped like the recorded morph/cloak frames (`XMAGE` set, flags per kind, the real name after the prefix). */
function withFaceDown(game: GameView, kind: GalleryFaceDown): GameView {
  const { prefix, image, rules, face } = FACE_DOWN[kind]
  const name = `${prefix}: ${face.name}`
  const perm: PermanentView = {
    id: FACE_DOWN_ID,
    name,
    displayName: name,
    expansionSetCode: 'XMAGE',
    cardNumber: '0',
    imageFileName: image,
    manaValue: 0,
    rarity: 'SPECIAL',
    cardTypes: ['CREATURE'],
    subTypes: [],
    power: '2',
    toughness: '2',
    rules,
    color: { white: false, blue: false, black: false, red: false, green: false },
    faceDown: true,
    morphed: kind === 'morph',
    manifested: kind === 'manifest',
    disguised: false,
    cloaked: false,
    tapped: false,
    counters: [],
  } as PermanentView
  return mapControlled(game, (p) => ({ ...p, battlefield: { ...p.battlefield, [FACE_DOWN_ID]: perm } }))
}

/** The face-down permanent is turned face up: same id, the face's name, set and P/T, the face-down flags cleared. */
function turnFaceUp(game: GameView, kind: GalleryFaceDown): GameView {
  const { face } = FACE_DOWN[kind]
  return mapControlled(game, (p) => {
    const perm = p.battlefield?.[FACE_DOWN_ID]
    if (!perm) return p
    const up = { ...perm, ...face, displayName: face.name, cardTypes: ['CREATURE'], imageFileName: undefined, rules: [], faceDown: false, morphed: false, manifested: false } as PermanentView
    return { ...p, battlefield: { ...p.battlefield, [FACE_DOWN_ID]: up } }
  })
}

/** Sets one counter on a player; the server sends player counters as {name, count} pairs and drops a counter at 0. */
function withPlayerCounter(game: GameView, playerId: string | undefined, name: string, count: number): GameView {
  return {
    ...game,
    players: players(game).map((p) => {
      if (p.playerId !== playerId) return p
      const others = (p.counters ?? []).filter((c) => c.name !== name)
      return { ...p, counters: count > 0 ? [...others, { name, count }] : others }
    }),
  }
}

/** Moves a permanent to another player's battlefield under the same id, as a control change does. */
function withControl(game: GameView, id: string, toId: string): GameView {
  const from = players(game).find((p) => p.battlefield?.[id])
  const perm = from?.battlefield?.[id]
  if (!from || !perm || from.playerId === toId) return game
  return {
    ...game,
    players: players(game).map((p) => {
      if (p === from) {
        const battlefield = { ...p.battlefield }
        delete battlefield[id]
        return { ...p, battlefield }
      }
      if (p.playerId === toId) return { ...p, battlefield: { ...p.battlefield, [id]: { ...perm, controllerId: toId, tapped: false } } }
      return p
    }),
  }
}

/** The commander of a player's command zone, as the server lists it there. */
function commanderOf(player: PlayerView | undefined): CardView | undefined {
  return ((player?.commandList ?? []) as CardView[]).find((item) => item.mageObjectType === 'COMMANDER')
}

/** Moves a player's commander out of the command zone into `zone` under the same id, as the engine keeps it. */
function withCommanderIn(game: GameView, playerId: string, zone: 'battlefield' | 'graveyard'): GameView {
  return {
    ...game,
    players: players(game).map((p) => {
      const commander = commanderOf(p)
      if (p.playerId !== playerId || !commander?.id) return p
      const placed = { ...commander, mageObjectType: zone === 'battlefield' ? 'PERMANENT' : 'CARD', controllerId: p.playerId, tapped: false } as PermanentView
      return {
        ...p,
        commandList: (p.commandList ?? []).filter((item) => (item as CardView).id !== commander.id),
        [zone]: { ...p[zone], [commander.id]: placed },
      }
    }),
  }
}

const COMMANDER_SPELL_ID = 'gallery-commander-spell'

/** My commander is cast from the command zone: it leaves it and goes on the stack under a spell id of its own, as the server sends it. */
function castMyCommander(game: GameView): GameView {
  const me = controlledPlayer(game)
  const commander = commanderOf(me)
  if (!me || !commander) return game
  return {
    ...game,
    stack: { [COMMANDER_SPELL_ID]: { ...commander, id: COMMANDER_SPELL_ID, mageObjectType: 'SPELL', controllerId: me.playerId, controllerName: me.name } } as GameView['stack'],
    players: players(game).map((p) => (p === me ? { ...p, commandList: (p.commandList ?? []).filter((item) => (item as CardView).id !== commander.id) } : p)),
  }
}

/** Puts a permanent into its controller's library (Chaos Warp, a tuck): it leaves the battlefield and the library grows. */
function tuckPermanent(game: GameView, id: string): GameView {
  return {
    ...game,
    players: players(game).map((p) => {
      if (!p.battlefield?.[id]) return p
      const battlefield = { ...p.battlefield }
      delete battlefield[id]
      return { ...p, battlefield, libraryCount: (p.libraryCount ?? 0) + 1 }
    }),
  }
}

/** Puts my first `count` hand cards back on top of my library, as Brainstorm does. */
function putBackFromHand(game: GameView, count: number): GameView {
  const me = controlledPlayer(game)
  const hand = Object.entries(game.myHand ?? {})
  if (!me || hand.length === 0) return game
  const back = hand.slice(0, count)
  return {
    ...game,
    myHand: Object.fromEntries(hand.slice(count)),
    players: players(game).map((p) => (p === me
      ? { ...p, handCount: Math.max(0, (p.handCount ?? 0) - back.length), libraryCount: (p.libraryCount ?? 0) + back.length }
      : p)),
  }
}

/** An opponent puts `count` cards of their hand into their library: the server only sends both counts. */
function opponentPutBack(game: GameView, owner: PlayerView | undefined, count: number): GameView {
  if (!owner) return game
  return {
    ...game,
    players: players(game).map((p) => (p.playerId === owner.playerId
      ? { ...p, handCount: Math.max(0, (p.handCount ?? 0) - count), libraryCount: (p.libraryCount ?? 0) + count }
      : p)),
  }
}

const RANCOR_ID = 'gallery-rancor'

/** Rancor on the stack, cast by me at one of my creatures. */
function withRancorOnStack(game: GameView, hostId: string): GameView {
  const me = controlledPlayer(game)
  const rancor: CardView = {
    id: RANCOR_ID,
    name: 'Rancor',
    displayName: 'Rancor',
    expansionSetCode: 'ULG',
    cardNumber: '110',
    manaValue: 1,
    rarity: 'COMMON',
    cardTypes: ['ENCHANTMENT'],
    subTypes: ['AURA'],
    manaCostLeftStr: ['{G}'],
    color: { white: false, blue: false, black: false, red: false, green: true },
    rules: ['Enchant creature', 'Enchanted creature gets +2/+0 and has trample.'],
    targets: [hostId],
    controllerId: me?.playerId,
    controllerName: me?.name,
  }
  return { ...game, stack: { [RANCOR_ID]: rancor } as GameView['stack'] }
}

/** Rancor resolves: it enters attached to its host (`attachedTo` on the aura, its id in the host's `attachments`). */
function resolveRancor(game: GameView): GameView {
  const rancor = game.stack?.[RANCOR_ID]
  const hostId = rancor?.targets?.[0]
  if (!rancor || !hostId) return game
  return {
    ...game,
    stack: {} as GameView['stack'],
    players: players(game).map((p) => {
      const host = p.battlefield?.[hostId]
      if (!host) return p
      const aura = { ...rancor, targets: [], attachedTo: hostId, attachments: [], tapped: false } as PermanentView
      return { ...p, battlefield: { ...p.battlefield, [hostId]: { ...host, attachments: [...(host.attachments ?? []), RANCOR_ID] }, [RANCOR_ID]: aura } }
    }),
  }
}

const MUTATE_SPELL_ID = 'gallery-mutate-spell'
const MUTATE_CARD_ID = 'gallery-mutate-card'

function gemrazer(id: string, owner: PlayerView | undefined): CardView {
  return {
    id,
    name: 'Gemrazer',
    displayName: 'Gemrazer',
    expansionSetCode: 'IKO',
    cardNumber: '155',
    manaValue: 4,
    rarity: 'RARE',
    cardTypes: ['CREATURE'],
    subTypes: ['BEAST'],
    manaCostLeftStr: ['{3}', '{G}'],
    color: { white: false, blue: false, black: false, red: false, green: true },
    power: '4',
    toughness: '4',
    rules: ['Mutate {1}{G}{G}', 'Reach', 'Trample'],
    controllerId: owner?.playerId,
    controllerName: owner?.name,
  }
}

/** Gemrazer cast for its mutate cost on the stack, under a spell id of its own, as the server sends it. */
function withMutateOnStack(game: GameView): GameView {
  return { ...game, stack: { [MUTATE_SPELL_ID]: gemrazer(MUTATE_SPELL_ID, controlledPlayer(game)) } as GameView['stack'] }
}

/**
 * Gemrazer merges with my creature: it leaves the stack and never enters on its own; the host keeps its
 * id, turns `mutated` and lists both cards in its `mutateView` (recorded `mutate.json` shape). Over, the
 * merged creature takes Gemrazer's face and P/T.
 */
function mutateOnto(game: GameView, hostId: string, over: boolean): GameView {
  const me = controlledPlayer(game)
  const host = me?.battlefield?.[hostId]
  if (!me || !host) return game
  const card = gemrazer(MUTATE_CARD_ID, me)
  const face = over ? { ...card, id: hostId } : {}
  const merged = { ...host, ...face, mutated: true, mutateView: { name: (over ? card : host).name, id: hostId, cards: { [hostId]: host, [MUTATE_CARD_ID]: card } } } as PermanentView
  return {
    ...game,
    stack: {} as GameView['stack'],
    players: players(game).map((p) => (p === me ? { ...p, battlefield: { ...p.battlefield, [hostId]: merged } } : p)),
  }
}

const SOURCE_ABILITY_ID = 'gallery-source-ability'

/** A triggered ability of `sourceId` goes on the stack; the server names its source in `sourceCard`. */
function triggerAbilityOf(game: GameView, sourceId: string): GameView {
  const me = controlledPlayer(game)
  const source = me?.battlefield?.[sourceId]
  if (!me || !source) return game
  const controller = { controllerId: me.playerId, controllerName: me.name }
  const ability = {
    id: SOURCE_ABILITY_ID,
    name: source.name,
    sourceName: source.name,
    mageObjectType: 'TRIGGERED_ABILITY',
    abilityType: 'Triggered',
    rules: [`Whenever ${source.name} becomes tapped, you gain 1 life.`],
    sourceCard: { id: sourceId, name: source.name, expansionSetCode: source.expansionSetCode, cardNumber: source.cardNumber, ...controller },
    ...controller,
  }
  return { ...game, stack: { [SOURCE_ABILITY_ID]: ability } as unknown as GameView['stack'] }
}

/** The first view of the next turn, with `who` active and holding priority. */
function startNextTurn(game: GameView, who: PlayerView | undefined, step = 'UPKEEP'): GameView {
  if (!who) return game
  return {
    ...game,
    turn: game.turn + 1,
    phase: step === 'UPKEEP' ? 'BEGINNING' : 'PRECOMBAT_MAIN',
    step,
    combat: [] as unknown as GameView['combat'],
    activePlayerId: who.playerId,
    activePlayerName: who.name,
    priorityPlayerName: who.name,
    players: players(game).map((p) => ({ ...p, isActive: p.playerId === who.playerId, hasPriority: p.playerId === who.playerId })),
  }
}

const STEP_PHASE: Record<string, string> = { b: 'BEGINNING', m1: 'PRECOMBAT_MAIN', c: 'COMBAT', m2: 'POSTCOMBAT_MAIN', e: 'END' }

/** Moves to the next step of the phase bar, wrapping from cleanup back to upkeep within the turn. */
function advanceStep(game: GameView): GameView {
  const index = STEPS.findIndex((s) => s.key === game.step)
  const next = STEPS[(index + 1) % STEPS.length]
  return withStep(game, STEP_PHASE[next.group] ?? 'BEGINNING', next.key)
}

const RECAP_CREATURE_ID = 'gallery-recap-creature'

/** The opponent's creature spell, on the stack and then on their battlefield under the same id. */
function recapCreature(owner: PlayerView): CardView {
  return { id: RECAP_CREATURE_ID, name: 'Grizzly Bears', displayName: 'Grizzly Bears', expansionSetCode: 'IMA', cardNumber: '165', manaValue: 2, cardTypes: ['Creature'], power: '2', toughness: '2', controllerId: owner.playerId, controllerName: owner.name }
}

/**
 * The views of one opponent turn, fed through the real `observeTurnRecap`: they cast Grizzly Bears,
 * attack with a creature, destroy my creature and take a life from me; then my turn starts.
 */
function opponentTurnRecapViews(base: GameView, myVictimId: string): GameView[] {
  const me = controlledPlayer(base)
  const opponent = opponentPlayer(base)
  if (!me || !opponent) return []
  const attackerId = creatureIds(opponent)[0]
  const oppTurn = startNextTurn(base, opponent, 'PRECOMBAT_MAIN')
  const cast = { ...oppTurn, stack: { [RECAP_CREATURE_ID]: recapCreature(opponent) } as GameView['stack'] }
  const resolved: GameView = {
    ...cast,
    stack: {} as GameView['stack'],
    players: players(cast).map((p) => (p.playerId === opponent.playerId ? { ...p, battlefield: { ...p.battlefield, [RECAP_CREATURE_ID]: recapCreature(opponent) } } : p)),
  }
  const group = { attackers: attackerId ? { [attackerId]: {} } : {}, blockers: {}, isBlocked: false, defenderId: me.playerId, defenderName: me.name }
  const attack = { ...withStep(resolved, 'COMBAT', 'DECLARE_ATTACKERS'), combat: [group] as unknown as GameView['combat'] }
  const afterCombat = loseLife(sendToGraveyard({ ...withStep(attack, 'POSTCOMBAT_MAIN', 'POSTCOMBAT_MAIN'), combat: [] as unknown as GameView['combat'] }, myVictimId), 1)
  return [oppTurn, cast, resolved, attack, afterCombat, startNextTurn(afterCombat, me)]
}

/** Replays the views through the turn-recap observer from a fresh window and shows the recap it closes with. */
function replayTurnRecap(views: GameView[], gameId: string): () => void {
  return () => {
    setState({ turnRecap: null })
    resetTurnRecap(gameId)
    let recap: TurnRecap | null = null
    for (let i = 0; i < views.length; i++) recap = observeTurnRecap(views[i - 1] ?? null, views[i], gameId) ?? recap
    const shown = recap
    if (shown) setTimeout(() => setState({ turnRecap: shown }), 60)
  }
}

/** Commander damage as the engine writes it: a sentence in the commander card's rules. */
function withCommanderDamage(game: GameView, ownerId: string, target: PlayerView, damage: number): GameView {
  const line = `<b>Commander</b> did ${damage} combat damage to player <font color='#20B2AA'>${target.name}</font>.`
  return {
    ...game,
    players: players(game).map((p) => (p.playerId === ownerId
      ? {
          ...p,
          commandList: (p.commandList ?? []).map((item, i) => (i === 0
            ? { ...(item as CardView), rules: [...((item as CardView).rules ?? []).filter((r) => !String(r).includes('combat damage to player')), line] }
            : item)),
        }
      : p)),
  }
}

function openDrawerTab(tab: string): void {
  const toggle = document.querySelector<HTMLElement>(`[data-testid="drawer-tab-${tab}"]`)
  if (toggle && toggle.getAttribute('aria-pressed') !== 'true') toggle.click()
}

/** Closes the end screen and opens it again, so its cinematic plays from the start. */
function replayGameEnd(info: GameEndInfo): () => void {
  return () => {
    setState({ gameEnd: null })
    setTimeout(() => setState({ gameEnd: info }), 60)
  }
}

function targetPlayerPrompt(game: GameView, gameId: string, playerId: string, required: boolean): FeedbackPrompt {
  const target = players(game).find((p) => p.playerId === playerId)
  return {
    method: 'GAME_TARGET',
    gameId,
    title: 'Select target player',
    message: required ? 'Select target player' : 'Select up to one target player',
    mode: 'uuid',
    options: [{ id: playerId, label: target?.name ?? playerId, value: playerId }],
    min: 1,
    max: 1,
    required,
    sourceName: 'Lightning Bolt',
  }
}

function withTopCardPeek(gv: GameView): GameView {
  const top = Object.values(gv.myHand ?? {})[0]
  if (!top?.id) return gv
  const peeked = { ...top, id: 'gallery-peek-top' }
  return { ...gv, lookedAt: [{ name: TOP_CARD_PEEK_NAME, cards: { [peeked.id]: peeked } }] }
}

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

const STAGING_DECK: Deck = {
  id: 'gallery-staging-deck',
  name: 'Rakdos Midrange',
  cards: [
    { cardName: 'Bloodtithe Harvester', setCode: 'VOW', cardNumber: '232', amount: 4 },
    { cardName: 'Fable of the Mirror-Breaker', setCode: 'NEO', cardNumber: '141', amount: 4 },
    { cardName: 'Swamp', setCode: 'LEA', cardNumber: '295', amount: 26 },
    { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 26 },
  ],
  sideboard: [],
}

const STAGING_POD_TABLE = makeLobbyTable(0, {
  tableId: 'gallery-staging-pod',
  tableName: 'Viernes de Commander',
  gameType: 'Commander Free For All',
  deckType: 'Variant Magic - Commander',
  controllerName: 'gallery-dev',
  tableState: 'WAITING',
  tableStateText: 'Waiting for players',
  seatsInfo: '3/4',
  seats: [
    { playerName: 'gallery-dev', seatIndex: 0, playerType: 'HUMAN', flagName: 'es', constructedRating: 1520, history: '3-1' },
    { playerName: 'bora-the-bold', seatIndex: 1, playerType: 'HUMAN', flagName: 'ru', constructedRating: 1602, history: '12-5' },
    { playerName: 'sim-000042', seatIndex: 2, playerType: 'SIM' },
    { playerName: '', seatIndex: 3, playerType: 'HUMAN' },
  ],
})

const STAGING_OPEN_TABLE = makeLobbyTable(0, {
  tableId: 'gallery-staging-open',
  tableName: 'Pauper a 1',
  gameType: 'Two Player Duel',
  deckType: 'Constructed - Pauper',
  controllerName: 'bora-the-bold',
  tableState: 'WAITING',
  tableStateText: 'Waiting for players',
  seatsInfo: '1/2',
  seats: [
    { playerName: 'bora-the-bold', seatIndex: 0, playerType: 'HUMAN', flagName: 'ru', constructedRating: 1602, history: '12-5' },
    { playerName: '', seatIndex: 1, playerType: 'HUMAN' },
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
    // Forma real del server: `CardsView(abilities, game)` serializa AbilityView
    // (name "Ability" + sourceCard/sourceName anidados) — no FeedbackCard plana.
    const triggers = myPermanents.slice(0, 2).map((id, index) => {
      const source = cardOf(me, id)
      const sourceName = source.name ?? id
      return {
        id: `${id}:ability-${index}`,
        name: sourceName,
        sourceName,
        sourceCard: source,
        expansionSetCode: source.expansionSetCode,
        cardNumber: source.cardNumber,
        rules: [`Whenever ${sourceName} or another creature enters the battlefield, you gain 1 life.`],
      }
    })
    const myHandCards = Object.entries(game.myHand ?? {}).map(([id, card]) => ({
      id: card.id ?? id,
      name: card.name ?? id,
      displayName: card.displayName,
      expansionSetCode: card.expansionSetCode,
      cardNumber: card.cardNumber,
      cardTypes: card.cardTypes,
    }))

    const graveZoneCard: CardView = {
      id: 'zone-grave-1',
      parentId: 'zone-grave-1',
      name: 'Grizzly Bears',
      displayName: 'Grizzly Bears',
      manaValue: 2,
      expansionSetCode: 'IMA',
      cardNumber: '165',
      cardTypes: ['Creature'],
      power: '2',
      toughness: '2',
    }
    const graveyardGame: GameView = {
      ...game,
      players: (game.players ?? []).map((player) =>
        player.controlled
          ? { ...player, graveyard: { ...player.graveyard, 'zone-grave-1': graveZoneCard } }
          : player,
      ),
    }

    // Jace, the Mind Sculptor +2: la carta del top llega en `lookedAt` (visor
    // "Miradas", que se engancha y queda abierto) y la decisión del motor es un
    // GAME_ASK booleano: Sí = enviarla al fondo, No = dejarla arriba.
    const jaceTopCard: CardView = {
      id: 'jace-top-1',
      parentId: 'jace-top-1',
      name: 'Island',
      displayName: 'Island',
      expansionSetCode: 'iko',
      cardNumber: '263',
      manaValue: 0,
      cardTypes: ['Land'],
    }
    const jaceTopGame: GameView = {
      ...game,
      lookedAt: [{ name: 'Jace, the Mind Sculptor', cards: { 'jace-top-1': jaceTopCard } }],
    }

    const prompts: { id: string; label: string; description: string; prompt: FeedbackPrompt; playableIds?: string[]; game?: GameView }[] = [
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
          isDeclaringAttackers: true,
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
        id: 'prompt:jace-top',
        label: 'GAME_ASK (Jace, the Mind Sculptor +2)',
        description: 'Carta del top en el visor "Miradas" + "Put that card on the bottom of its owner\'s library?" (Sí = al fondo, No = dejarla arriba).',
        prompt: {
          method: 'GAME_ASK',
          gameId,
          title: 'Jace, the Mind Sculptor',
          message: "Put that card on the bottom of its owner's library?",
          mode: 'boolean',
          options: [
            { id: 'yes', label: 'Sí', value: 'true' },
            { id: 'no', label: 'No', value: 'false' },
          ],
          min: 0,
          max: 0,
          sourceName: 'Jace, the Mind Sculptor',
        },
        game: jaceTopGame,
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
        id: 'prompt:london-bottom',
        label: 'Mulligan de Londres (al fondo)',
        description: 'Una carta por clic; muestra cuántas faltan por poner al fondo.',
        prompt: {
          method: 'GAME_TARGET',
          gameId,
          title: 'Choose target',
          message: 'Select a card (2 more) to put on the bottom of your library',
          mode: 'uuid',
          options: Object.keys(game.myHand ?? {}).map((id) => ({ id, label: game.myHand[id]?.name ?? id, value: id })),
          min: 0,
          max: 0,
          required: true,
          isMulliganLondon: true,
          progress: { selected: 0, remaining: 2 },
        },
      },
      {
        id: 'prompt:target-zone-graveyard',
        label: 'Target zone (graveyard)',
        description: 'GAME_TARGET with targetZone GRAVEYARD: the graveyard pile is highlighted and auto-opens with the target card inside.',
        prompt: {
          method: 'GAME_TARGET',
          gameId,
          title: 'Choose target',
          message: 'Select target creature card in a graveyard',
          mode: 'uuid',
          options: [{ id: 'zone-grave-1', label: 'Grizzly Bears', value: 'zone-grave-1' }],
          min: 1,
          max: 1,
          required: true,
          targetZone: 'GRAVEYARD',
          sourceName: 'Reanimate',
        },
        game: graveyardGame,
      },
      {
        id: 'prompt:graveyard-grid',
        label: 'Selección múltiple (cementerio)',
        description: 'GAME_TARGET con cartas: la selección la lleva el servidor y se ve el contador.',
        prompt: {
          method: 'GAME_TARGET',
          gameId,
          title: 'Choose target',
          message: 'Select cards from your graveyard (selected 1 of 3, min 1)',
          mode: 'uuid',
          options: LIBRARY_CARDS.map((c) => ({ id: c.id, label: c.name, value: c.id })),
          min: 0,
          max: 0,
          required: false,
          chosenTargets: ['g5'],
          progress: { selected: 1, max: 3, min: 1 },
          cards: LIBRARY_CARDS,
          sourceName: 'Raise the Past',
        },
      },
      {
        id: 'prompt:discard-hand',
        label: 'Descarte desde la mano (barra)',
        description: 'GAME_TARGET con las cartas de tu mano: se resuelve clicando la mano, sin grid modal y con el tablero visible.',
        prompt: {
          method: 'GAME_TARGET',
          gameId,
          title: 'Choose a card to discard',
          message: 'Select a card to discard',
          mode: 'uuid',
          options: myHandCards.map((c) => ({ id: c.id, label: c.name, value: c.id })),
          min: 1,
          max: 1,
          required: true,
          cards: myHandCards,
          targetZone: 'HAND',
          sourceName: 'Mind Rot',
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
        id: 'prompt:card-grid-filtered',
        label: 'Búsqueda filtrada (solo válidas)',
        description: 'Filtered search: the grid pre-filters to the cards the target accepts (options.possibleTargets) and a toggle reveals the remaining candidates.',
        prompt: {
          method: 'GAME_TARGET',
          gameId,
          title: 'Search your library',
          message: 'Search your library for a creature card',
          mode: 'uuid',
          options: LIBRARY_CARDS.filter((c) => (c.cardTypes ?? []).includes('Creature')).map((c) => ({ id: c.id, label: c.name, value: c.id })),
          min: 0,
          max: 1,
          required: true,
          cards: LIBRARY_CARDS,
          sourceName: 'Chord of Calling',
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
        game: p.game ?? game,
        gameId,
        feedback: p.prompt,
        playableIds: p.playableIds,
      })
    }

    entries.push({
      id: 'anim:draw-slide',
      group: 'Animaciones',
      label: 'Robo: deslizar desde biblioteca',
      description: 'Pulsa "Robar carta": aparece una carta nueva en tu mano y debe deslizar desde la biblioteca.',
      phase: 'game',
      game,
      gameId,
      action: { label: 'Robar carta', apply: drawOneCard },
    })
    entries.push({
      id: 'anim:priority-orb',
      group: 'Animaciones',
      label: 'Prioridad: orbe',
      description: 'Pulsa "Pasar prioridad": el orbe dorado debe viajar del avatar que tenía prioridad al nuevo.',
      phase: 'game',
      game,
      gameId,
      action: { label: 'Pasar prioridad', apply: passPriority },
    })
    entries.push({
      id: 'anim:target-damage',
      group: 'Animaciones',
      label: 'Objetivo: daño (beacon + shake)',
      description: 'Pulsa el botón: la carta objetivo recibe la clase took-damage y debe mostrar beacon, shake y flash a la vez.',
      phase: 'game',
      game,
      gameId,
      feedback: targetPrompt(game, gameId, true),
      action: { label: 'Simular daño en objetivo', run: simulateTargetDamage },
    })
    entries.push({
      id: 'anim:mana-tap',
      group: 'Animaciones',
      label: 'Land: mana pulse + particle (A2)',
      description: 'Press "Tap land": an untapped land turns tapped, shows a ring in its color (one pulse) and sends one particle to its controller\'s mana pool.',
      phase: 'game',
      game,
      gameId,
      action: { label: 'Tap land', apply: tapOneLand },
    })
    entries.push({
      id: 'stack:identical-pile',
      group: 'Pila',
      label: 'Stack: identical spells pile',
      description: 'Three identical instants from the same controller, no targets: they fold into one row with ×3 and the cards beneath peek out below the top one.',
      phase: 'game',
      game: withIdenticalSpellPile(game),
      gameId,
    })
    entries.push({
      id: 'stack:entry-animation',
      group: 'Pila',
      label: 'Stack: entry animation (press the button)',
      description: 'Each press puts a new spell on top of the pile: the new top card and its tab ease in. Press it to replay the entry animation.',
      phase: 'game',
      game: withIdenticalSpellPile(game),
      gameId,
      action: { label: 'Lanzar hechizo a la pila', apply: pushStackEntry },
    })
    entries.push({
      id: 'stack:mixed-kinds',
      group: 'Pila',
      label: 'Stack: triggered ability, spell, creature cast',
      description: 'One triggered ability, one instant and one creature spell: each row names its kind (habilidad disparada, hechizo, criatura).',
      phase: 'game',
      game: withMixedStackKinds(game),
      gameId,
    })
    entries.push({
      id: 'anim:projectile',
      group: 'Animaciones',
      label: 'Stack: spell projectile to target',
      description: 'The orb flies from the stack card box to the target box on mount and on each "Replay" press (260-480 ms by distance; nothing when effects are off).',
      screen: 'projectile',
      action: { label: 'Replay', run: replayProjectileDemo },
    })
    const bolted = calmGame(game)
    const opponent = opponentPlayer(bolted)
    const opponentCreature = creatureIds(opponent)[0]
    if (opponentCreature) {
      entries.push({
        id: 'anim:spell-hit-creature',
        group: 'Animaciones',
        label: 'Stack: Bolt hits a creature (projectile → shake → -3)',
        description: 'Press "Resolve": the spell leaves the stack, the projectile flies to the creature, and the shake, sparks and -3 land on arrival. Reselect the entry to play it again.',
        phase: 'game',
        game: withBoltTargeting(bolted, opponentCreature),
        gameId,
        action: { label: 'Resolve Bolt', apply: resolveBoltOn(opponentCreature) },
      })
      entries.push({
        id: 'anim:fizzle',
        group: 'Animaciones',
        label: 'Stack: a spell fizzles',
        description: 'Your Lightning Bolt targets a creature that is gone by the time it resolves. "Replay" feeds the server\'s line "Lightning Bolt has been fizzled." and resolves it: no projectile flies, the spell goes grey and drifts apart like smoke on the stack, then falls to the graveyard.',
        phase: 'game',
        game: withBoltTargeting(bolted, opponentCreature),
        gameId,
        action: { label: 'Replay', run: replayQuietWithLog(withBoltTargeting(bolted, opponentCreature), gameId, () => 'Lightning Bolt has been fizzled.', (g) => ({ ...g, stack: {} as unknown as GameView['stack'] })) },
      })
    }
    if (opponent && opponentCreature) {
      const sequenceGame = withFourStackSpells(calmGame(game), opponentCreature, opponent.playerId)
      entries.push({
        id: 'anim:stack-sequence',
        group: 'Animaciones',
        label: 'Stack: projectile sequence (4 spells, one update)',
        description: 'Four spells on the stack, top first, targeting a creature and a player. "Replay" removes them all in one update: each projectile leaves 220 ms after the previous one and lands on its target. Each press re-creates the stack first, so it can be replayed.',
        phase: 'game',
        game: sequenceGame,
        gameId,
        action: { label: 'Replay', run: replayStackSequence(sequenceGame) },
      })
    }
    if (opponent) {
      entries.push({
        id: 'anim:spell-hit-player',
        group: 'Animaciones',
        label: 'Stack: Bolt hits a player (projectile → shake → -3)',
        description: 'Press "Resolve": the projectile flies to the opponent info bar, and the shake and -3 land on arrival. Reselect the entry to play it again.',
        phase: 'game',
        game: withBoltTargeting(bolted, opponent.playerId),
        gameId,
        action: { label: 'Resolve Bolt', apply: resolveBoltOn(opponent.playerId) },
      })
    }
    entries.push({
      id: 'anim:stack-countdown',
      group: 'Animaciones',
      label: 'Stack: top-card countdown',
      description: 'Two spells on the stack: the top card pulses and a 2 px bar fills over 3 s. Nothing resolves visually.',
      phase: 'game',
      game: withSpellStack(game),
      gameId,
    })

    const animBase = calmGame(game)
    const mystic = creatureIds(me)[0] ?? ''
    const tappedBoard = setControlledTapped(animBase, true)
    const opponentOfBase = opponentPlayer(animBase)
    const opponentHandBase = withOpponentHandDelta(animBase, opponentOfBase, +1)
    const fourPlayers = calmGame(FOUR_PLAYER_GAME ?? game)
    const opponentOfFour = opponentPlayer(fourPlayers)?.playerId ?? ''

    entries.push({
      id: 'anim:untap-wave',
      group: 'Animaciones',
      label: 'Board: untap wave (B5)',
      description: 'Press "Untap all": every tapped permanent of yours untaps in a 40 ms stagger (the wave), no attacker involved.',
      phase: 'game',
      game: tappedBoard,
      gameId,
      action: { label: 'Untap all', apply: (g) => setControlledTapped(g, false) },
    })
    entries.push({
      id: 'anim:life-5',
      group: 'Animaciones',
      label: 'Life: 5 (low-life vignette)',
      description: 'Press to set your life to 5: the low-life vignette turns on (active, slow pulse).',
      phase: 'game',
      game: animBase,
      gameId,
      action: { label: 'Poner mi vida a 5', apply: (g) => withLife(g, 5) },
    })
    entries.push({
      id: 'anim:life-2',
      group: 'Animaciones',
      label: 'Life: 2 (critical vignette)',
      description: 'Press to set your life to 2: the vignette turns critical (stronger, faster pulse).',
      phase: 'game',
      game: animBase,
      gameId,
      action: { label: 'Poner mi vida a 2', apply: (g) => withLife(g, 2) },
    })
    entries.push({
      id: 'anim:life-6',
      group: 'Animaciones',
      label: 'Life: 6 (no vignette)',
      description: 'Your life is 6: nothing should render. No action.',
      phase: 'game',
      game: withLife(animBase, 6),
      gameId,
    })
    entries.push({
      id: 'anim:token-pop',
      group: 'Animaciones',
      label: 'Token: pop (D3)',
      description: 'Press "Añadir ficha Soldado": only the new token pops (spring scale) and a burst of six dots flies out of it. Existing permanents stay still.',
      phase: 'game',
      game: animBase,
      gameId,
      action: { label: 'Añadir ficha Soldado', apply: addSoldierToken },
    })
    entries.push({
      id: 'anim:sickness',
      group: 'Animaciones',
      label: 'Sickness: badge on a new creature (summoning sickness)',
      description: 'Press "Invocar criatura": a new creature with summoning sickness enters your battlefield and its badge floats (sicknessFloat loops forever).',
      phase: 'game',
      game: animBase,
      gameId,
      action: { label: 'Invocar criatura', apply: (g) => addSickCreature(g).game },
    })
    entries.push({
      id: 'anim:entered-glow',
      group: 'Animaciones',
      label: 'Entered: gold glow on a new creature (enteredGlow)',
      description: 'Press "Entrar criatura": a new creature enters your battlefield marked as entered this turn, so it shows the gold glow (enteredGlow loops forever).',
      phase: 'game',
      game: animBase,
      gameId,
      action: {
        label: 'Entrar criatura',
        run: () => {
          const game = getState().game
          if (!game) return
          const { id, game: next } = addSickCreature(game)
          setState({ game: next, enteredThisTurn: { [id]: true as const } })
        },
      },
    })
    entries.push({
      id: 'anim:keyword-auras',
      group: 'Animaciones',
      label: 'Keyword auras: a looping effect per main keyword',
      description: '"Replay" puts seven creatures on your battlefield, one per aura keyword (indestructible, hexproof, deathtouch, flying, lifelink, trample, haste), each showing its looping aura (kwAura… keyframes).',
      phase: 'game',
      game: animBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(animBase, gameId, addKeywordCreatures) },
    })
    const keywordGainBase = withKeywordGainBear(animBase)
    entries.push({
      id: 'anim:keyword-gain',
      group: 'Animaciones',
      label: 'Keyword gained: the coin pops and the aura flares',
      description: '"Replay" grants Grizzly Bears flying: the flying coin pops in and the blue aura flares once, then loops.',
      phase: 'game',
      game: keywordGainBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(keywordGainBase, gameId, (g) => withRules(g, 'gallery-kw-gain', ['Flying'])) },
    })
    const auraGainBase = withAuraGainBear(animBase)
    entries.push({
      id: 'anim:aura-keyword-gain',
      group: 'Animaciones',
      label: 'Aura grants flying: the coin still pops',
      description: '"Replay" attaches a flying Aura to Grizzly Bears: the bear is re-nested under the Aura, and its flying coin still pops in and the blue aura flares once.',
      phase: 'game',
      game: auraGainBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(auraGainBase, gameId, (g) => withAuraAttached(g, 'gallery-kw-gain', 'gallery-aura', ['Flying'])) },
    })
    entries.push({
      id: 'anim:dissolve',
      group: 'Animaciones',
      label: 'Graveyard: dissolve (D4)',
      description: 'Press to send Elvish Mystic to your graveyard: a ghost copy fades out over 300 ms where it stood.',
      phase: 'game',
      game: animBase,
      gameId,
      action: { label: 'Enviar Elvish Mystic al cementerio', apply: (g) => sendToGraveyard(g, mystic) },
    })
    entries.push({
      id: 'anim:stack-trail',
      group: 'Animaciones',
      label: 'Stack: gold trail (A1 spell)',
      description: 'Press to cast the first instant from your hand: it flies to the stack with the gold trail.',
      phase: 'game',
      game: withInstantInHand(animBase),
      gameId,
      action: { label: 'Lanzar primer instantáneo', apply: castFirstInstant },
    })
    const ownCastBase = withInstantInHand(animBase)
    entries.push({
      id: 'anim:spell-cast-own',
      group: 'Animaciones',
      label: 'Spell: cast from hand, lift and fly to the stack',
      description: 'Press to cast the first instant from your hand: it rises to the middle of the screen, holds, then flies to the stack with the gold trail. "Replay" puts it back in your hand and casts it again.',
      phase: 'game',
      game: ownCastBase,
      gameId,
      action: { label: 'Replay', run: replayCast(ownCastBase, castFirstInstant) },
    })
    entries.push({
      id: 'anim:spell-cast-opp',
      group: 'Animaciones',
      label: 'Opponent spell: lift and fly to the stack',
      description: 'Press to cast an instant from the opponent: it rises to the middle of the screen, holds, then flies from their hand to the stack. "Replay" puts it back in their hand and casts it again.',
      phase: 'game',
      game: opponentHandBase,
      gameId,
      action: { label: 'Replay', run: replayCast(opponentHandBase, (g) => castOpponentBolt(g, opponentOfBase)) },
    })
    const counterBase = withPlusCounter(animBase, mystic, 1)
    entries.push({
      id: 'anim:counter-change',
      group: 'Animaciones',
      label: 'Counter: +1/+1 added, pulse and tick',
      description: 'Press "Replay" to reset the creature to one +1/+1 counter and then put a second one on it: the badge pulses with a gold flash and an expanding ring, a "+1" rises above it, and the number ticks up.',
      phase: 'game',
      game: counterBase,
      gameId,
      action: { label: 'Replay', run: replayCast(counterBase, (g) => withPlusCounter(g, mystic, 2)) },
    })
    const loyaltyBase = withLoyalty(animBase, mystic, 4)
    entries.push({
      id: 'anim:loyalty-change',
      group: 'Animaciones',
      label: 'Planeswalker: loyalty change, pulse and tick',
      description: 'Press "Replay" to reset the planeswalker to 4 loyalty and then activate a minus ability: the loyalty badge pulses with a purple flash and an expanding ring, a "-2" falls above it, and the number ticks down.',
      phase: 'game',
      game: loyaltyBase,
      gameId,
      action: { label: 'Replay', run: replayCast(loyaltyBase, (g) => withLoyalty(g, mystic, 2)) },
    })
    const hostIds = [mystic, GALLERY_HOST_ID]
    {
      const equipBase = withEquipmentOn(withSecondHost(animBase, mystic), hostIds[0], hostIds[0])
      entries.push({
        id: 'anim:equip-move',
        group: 'Animaciones',
        label: 'Equipment: moves to another creature',
        description: 'Press "Replay" to reset the equipment onto the first creature and then equip the second: the equipment flies with a gold trail from beside the first creature to its new slot.',
        phase: 'game',
        game: equipBase,
        gameId,
        action: { label: 'Replay', run: replayCast(equipBase, (g) => withEquipmentOn(g, hostIds[0], hostIds[1])) },
      })
    }
    entries.push({
      id: 'anim:mill',
      group: 'Animaciones',
      label: 'Mill: card flies from the library to the graveyard',
      description: 'Press "Replay" to mill a card: it leaves the library stack and flies to the graveyard pile.',
      phase: 'game',
      game: animBase,
      gameId,
      action: { label: 'Replay', run: replayCast(animBase, (g) => withMilledCard(g, mystic)) },
    })
    const counterBaseGame = withCounterspellOnStack(animBase, mystic)
    entries.push({
      id: 'anim:countered',
      group: 'Animaciones',
      label: 'Stack: countered spell cracks and shatters',
      description: 'The opponent\'s Lightning Bolt targets your creature and your Counterspell, on top, targets the Bolt. "Replay" resolves both in one update: Counterspell\'s projectile hits the Bolt, which shudders, drains of colour, cracks and bursts into blue shards, then falls to the graveyard. No projectile reaches the creature.',
      phase: 'game',
      game: counterBaseGame,
      gameId,
      action: { label: 'Replay', run: replayQuiet(counterBaseGame, gameId, resolveCounterspell) },
    })
    const delverFront = withDelver(animBase, mystic, false)
    entries.push({
      id: 'anim:transform',
      group: 'Animaciones',
      label: 'Transform: double-faced card flips to its other face',
      description: 'Press "Replay" to reset Delver of Secrets to its front face and then transform it: the card turns edge-on, comes back as Insectile Aberration with a bright flash, a light sweep crosses it and a white-gold ring spreads out.',
      phase: 'game',
      game: delverFront,
      gameId,
      action: { label: 'Replay', run: replayQuiet(delverFront, gameId, (g) => withDelver(g, mystic, true)) },
    })
    entries.push({
      id: 'anim:bounce',
      group: 'Animaciones',
      label: 'Bounce: your permanent returns to your hand',
      description: 'Press "Replay" to return Elvish Mystic to your hand: a blue swirl closes in where it stood and the card flies to your hand.',
      phase: 'game',
      game: animBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(animBase, gameId, (g) => bounceToMyHand(g, mystic)) },
    })
    const opponentBounceId = opponentNonLandId(opponentOfBase)
    if (opponentBounceId) {
      entries.push({
        id: 'anim:opp-bounce',
        group: 'Animaciones',
        label: 'Bounce: an opponent permanent returns to their hand',
        description: 'Press "Replay" to return an opponent\'s permanent to their hand (the server only sends their hand count): the blue swirl plays and the card flies to their hand, with no face-down draw from the library.',
        phase: 'game',
        game: animBase,
        gameId,
        action: { label: 'Replay', run: replayQuiet(animBase, gameId, (g) => bounceToOpponentHand(g, opponentOfBase, opponentBounceId)) },
      })
    }
    const lifeGainBase = withLife(animBase, 14)
    entries.push({
      id: 'anim:life-gain',
      group: 'Animaciones',
      label: 'Life gain: green motes rise over your portrait',
      description: 'Press "Replay" to set your life to 14 and then gain 4: a green glow lights your info bar, green-gold motes rise out of it and a "+4" floats up.',
      phase: 'game',
      game: lifeGainBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(lifeGainBase, gameId, (g) => withLife(g, 18)) },
    })
    const meOfBase = controlledPlayer(animBase)
    entries.push({
      id: 'anim:shuffle',
      group: 'Animaciones',
      label: 'Shuffle: your library (new table, chip)',
      description: 'Press "Replay" to feed the server\'s log line "<you>\'s library is shuffled": a mini deck of three card backs in your sleeve pops out above the library chip of your portrait, splits in two halves, riffles single cards back into the middle and drops into the chip.',
      phase: 'game',
      game: animBase,
      gameId,
      gameUi: 'v2',
      action: { label: 'Replay', run: announceShuffle(meOfBase) },
    })
    entries.push({
      id: 'anim:shuffle-opp',
      group: 'Animaciones',
      label: 'Shuffle: opponent library (new table, chip)',
      description: 'Same log line for the opponent: the mini deck (default card back) riffles above the library chip of their portrait.',
      phase: 'game',
      game: animBase,
      gameId,
      gameUi: 'v2',
      action: { label: 'Replay', run: announceShuffle(opponentOfBase) },
    })
    entries.push({
      id: 'anim:scry',
      group: 'Animaciones',
      label: 'Scry: your library peeks',
      description: 'Press "Replay" to feed the server\'s log line "<you> scries 2": the two top cards lift face down off your library chip, fan out for a moment and settle back.',
      phase: 'game',
      game: animBase,
      gameId,
      gameUi: 'v2',
      action: { label: 'Replay', run: announce(`${logName(meOfBase?.name ?? 'You')} scries 2 (source: <font color='#6495ED'>Opt</font>)`) },
    })
    entries.push({
      id: 'anim:surveil-opp',
      group: 'Animaciones',
      label: 'Surveil: opponent library peeks',
      description: 'Same for the opponent\'s log line "<opponent> surveils 3": three cards lift off their library chip and settle back (cards that go to the graveyard fly there through the ordinary zone change).',
      phase: 'game',
      game: animBase,
      gameId,
      gameUi: 'v2',
      action: { label: 'Replay', run: announce(`${logName(opponentOfBase?.name ?? 'Opponent')} surveils 3 (source: <font color='#6495ED'>Thoughtbound Phantasm</font>)`) },
    })
    entries.push({
      id: 'anim:shuffle-classic',
      group: 'Animaciones',
      label: 'Shuffle: your library (classic table, pile)',
      description: 'Classic table, where the library is a pile of card backs: "Replay" riffles the pile in place, the two halves fan out, single cards fall back into the middle and the pile squares up.',
      phase: 'game',
      game: animBase,
      gameId,
      gameUi: 'v1',
      action: { label: 'Replay', run: announceShuffle(meOfBase) },
    })
    const meName = meOfBase?.name ?? 'You'
    const mysticName = meOfBase?.battlefield?.[mystic]?.name ?? 'Elvish Mystic'
    entries.push({
      id: 'anim:flicker',
      group: 'Animaciones',
      label: 'Flicker: exiled and returned in one go',
      description: `Press "Replay" to feed the server's log line "${meName} puts ${mysticName} from exile onto the Battlefield" while it is still on the battlefield (a flicker keeps its id, so the view shows nothing): the card collapses to a sliver of light inside a closing frame, flashes and snaps back with a ring.`,
      phase: 'game',
      game: animBase,
      gameId,
      action: { label: 'Replay', run: announce(`${logName(meName)} puts ${logObject(mystic, mysticName)} from exile onto the Battlefield (source: ${logName('Ephemerate')})`) },
    })
    entries.push({
      id: 'anim:pay-paid',
      group: 'Animaciones',
      label: 'Pay to prevent: you pay',
      description: '"Replay" feeds "<you> chooses to pay {2} to prevent the counter effect": a gold ring sweeps out of your portrait.',
      phase: 'game',
      game: animBase,
      gameId,
      action: { label: 'Replay', run: announce(`${logName(meName)} chooses to pay {2} to prevent the counter effect`) },
    })
    entries.push({
      id: 'anim:pay-declined-opp',
      group: 'Animaciones',
      label: 'Pay to prevent: the opponent declines',
      description: '"Replay" feeds the opponent\'s "chooses not to pay": their portrait dims and shakes its head.',
      phase: 'game',
      game: animBase,
      gameId,
      action: { label: 'Replay', run: announce(`${logName(opponentOfBase?.name ?? 'Opponent')} chooses not to pay {3} to prevent the counter effect`) },
    })
    entries.push({
      id: 'anim:chosen-card',
      group: 'Animaciones',
      label: 'Choice: a value chosen on a card',
      description: `"Replay" feeds "${mysticName}: <you> has chosen Blue": "Blue" floats up from the card in a gold box.`,
      phase: 'game',
      game: animBase,
      gameId,
      action: { label: 'Replay', run: announce(`${logObject(mystic, mysticName)}: ${logName(meName)} has chosen Blue`) },
    })
    entries.push({
      id: 'anim:chosen-player',
      group: 'Animaciones',
      label: 'Choice: a value with no card on the board',
      description: '"Replay" feeds a choice whose source carries no id: "Elf" floats up from the opponent\'s portrait instead.',
      phase: 'game',
      game: animBase,
      gameId,
      action: { label: 'Replay', run: announce(`Adaptive Automaton: ${logName(opponentOfBase?.name ?? 'Opponent')} has chosen Elf`) },
    })
    entries.push({
      id: 'anim:behold',
      group: 'Animaciones',
      label: 'Behold: a card is shown',
      description: `"Replay" feeds "<you> chooses to behold ${mysticName}": the card lifts and catches a white flash.`,
      phase: 'game',
      game: animBase,
      gameId,
      action: { label: 'Replay', run: announce(`${logName(meName)} chooses to behold ${logObject(mystic, mysticName)}`) },
    })
    const monarchMine = withDesignation(animBase, 'monarch', meOfBase?.playerId ?? null)
    if (opponentOfBase) {
      entries.push({
        id: 'anim:monarch-pass',
        group: 'Animaciones',
        label: 'Monarch: the crown flies to the new monarch',
        description: 'You are the monarch. "Replay" makes the opponent the monarch: a gold crown token leaves your portrait, arcs over the board and lands on theirs, where a gold ring spreads and the crown badge pops.',
        phase: 'game',
        game: monarchMine,
        gameId,
        action: { label: 'Replay', run: replayQuiet(monarchMine, gameId, (g) => withDesignation(g, 'monarch', opponentOfBase.playerId)) },
      })
    }
    entries.push({
      id: 'anim:initiative-take',
      group: 'Animaciones',
      label: 'Initiative: taken when nobody had it',
      description: 'Nobody has the initiative. "Replay" gives it to you: the ember token drops from above onto your portrait and the initiative badge pops.',
      phase: 'game',
      game: animBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(animBase, gameId, (g) => withDesignation(g, 'initiative', meOfBase?.playerId ?? null)) },
    })
    const podBase = fourPlayers
    const podVictim = opponentPlayer(podBase)
    if (podVictim) {
      entries.push({
        id: 'anim:player-eliminated',
        group: 'Animaciones',
        label: 'Multiplayer: a player is eliminated',
        description: `Four-player pod. "Replay" drops ${podVictim.name} to 0 life and out of the game: their seat jolts, cracks open in red and white, sheds shards and drains to grey as the defeated card fades in; then it folds into the strip.`,
        phase: 'game',
        game: podBase,
        gameId,
        boardLayout: 'pod',
        action: { label: 'Replay', run: replayQuiet(podBase, gameId, (g) => withPlayerOut(g, podVictim.playerId)) },
      })
      entries.push({
        id: 'anim:player-conceded',
        group: 'Animaciones',
        label: 'Multiplayer: a player concedes',
        description: `Four-player pod. "Replay" feeds "${podVictim.name} has conceded." and takes them out of the game: no crack and no shards, the seat bows out under a white wash and drains to grey as the defeated card fades in.`,
        phase: 'game',
        game: podBase,
        gameId,
        boardLayout: 'pod',
        action: { label: 'Replay', run: replayQuietWithLog(podBase, gameId, () => `${logName(podVictim.name)} has conceded.`, (g) => withPlayerOut(g, podVictim.playerId)) },
      })
    }
    const seatShrunk = players(fourPlayers).find((p) => !p.controlled && p.playerId !== opponentOfFour)
    if (seatShrunk && opponentOfFour) {
      entries.push({
        id: 'anim:seat-focus-pulse',
        group: 'Animaciones',
        label: 'Focused board: a shrunk seat pulses when a permanent enters',
        description: `Four-player arena with ${players(fourPlayers).find((p) => p.playerId === opponentOfFour)?.name ?? 'an opponent'} focused. "Replay" puts a land on ${seatShrunk.name}'s battlefield: their status strip, shrunk beside the focused board, pulses once in gold.`,
        phase: 'game',
        game: fourPlayers,
        gameId,
        boardLayout: 'arena',
        seatFocus: opponentOfFour,
        action: { label: 'Replay', run: replayQuiet(fourPlayers, gameId, (g) => withPermanentOn(g, seatShrunk.playerId, 'gallery-seat-land')) },
      })
    }
    const copySeat = opponentOfFour ? players(fourPlayers).find((p) => p.playerId !== opponentOfFour && !p.controlled) : undefined
    if (copySeat && opponentOfFour) {
      entries.push({
        id: 'anim:spotlight-copy-pulse',
        group: 'Animaciones',
        label: 'Main board with side panel: a copy pulses when a permanent enters',
        description: `Four-player arena with the main board setting on: ${players(fourPlayers).find((p) => p.playerId === opponentOfFour)?.name ?? 'an opponent'} fills the main area and ${copySeat.name} sits in the side panel as a copy. "Replay" puts a land on ${copySeat.name}'s battlefield: their copy pulses once in gold.`,
        phase: 'game',
        game: fourPlayers,
        gameId,
        boardLayout: 'arena',
        boardSpotlight: true,
        action: { label: 'Replay', run: replayQuiet(fourPlayers, gameId, (g) => withPermanentOn(g, copySeat.playerId, 'gallery-copy-land')) },
      })
    }
    entries.push({
      id: 'anim:dice-roll',
      group: 'Animaciones',
      label: 'Dice: you roll a d20',
      description: `Press "Replay" to feed the log line "[Roll a die] ${meName} rolled a d20, result: 17": a hexagonal die in your seat colour tumbles in from the corner, bounces, settles and shows 17 above your name.`,
      phase: 'game',
      game: animBase,
      gameId,
      action: { label: 'Replay', run: announce(`[Roll a die] ${logName(meName)} rolled a d20, result: 17 (source: ${logName('Delina, Wild Mage')})`) },
    })
    if (opponentOfBase) {
      entries.push({
        id: 'anim:dice-roll-multi',
        group: 'Animaciones',
        label: 'Dice: the opponent rolls 2d6',
        description: `"[Roll a die] ${opponentOfBase.name} rolled 2d6, results: [4, 6]": two square dice in the opponent's seat colour tumble in one after the other.`,
        phase: 'game',
        game: animBase,
        gameId,
        action: { label: 'Replay', run: announce(`[Roll a die] ${logName(opponentOfBase.name)} rolled 2d6, results: [4, 6] (source: ${logName('Wyll, Blade of Frontiers')})`) },
      })
    }
    entries.push({
      id: 'anim:dice-planar',
      group: 'Animaciones',
      label: 'Dice: planar die (chaos)',
      description: `"[Roll a planar die] ${meName} rolled Chaos Roll": the planar die lands on the chaos symbol.`,
      phase: 'game',
      game: animBase,
      gameId,
      action: { label: 'Replay', run: announce(`[Roll a planar die] ${logName(meName)} rolled Chaos Roll`) },
    })
    entries.push({
      id: 'anim:phase-out',
      group: 'Animaciones',
      label: 'Phasing: a permanent phases out',
      description: 'Press "Replay" to phase Elvish Mystic out: it stops being drawn, and a ghost of it jitters, takes a blue scan-line tint and fades away where it stood.',
      phase: 'game',
      game: animBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(animBase, gameId, (g) => withPhased(g, mystic, false)) },
    })
    const phasedOut = withPhased(animBase, mystic, false)
    entries.push({
      id: 'anim:phase-in',
      group: 'Animaciones',
      label: 'Phasing: a permanent phases back in',
      description: 'Elvish Mystic starts phased out (not drawn). "Replay" phases it in: it fades up from translucent with the same jitter and scan lines, which slide off it.',
      phase: 'game',
      game: phasedOut,
      gameId,
      action: { label: 'Replay', run: replayQuiet(phasedOut, gameId, (g) => withPhased(g, mystic, true)) },
    })
    const mulliganBase = mulliganHand(animBase, 0)
    entries.push({
      id: 'anim:mulligan',
      group: 'Animaciones',
      label: 'Mulligan: your hand goes back and a new one is dealt',
      description: 'Pre-game view (turn 1, no phase) with a 7-card hand. "Replay" takes a mulligan: the seven cards turn face down and fly back to your library one after another, and the new seven are dealt from it in a quick stagger.',
      phase: 'game',
      game: mulliganBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(mulliganBase, gameId, (g) => mulliganHand(g, 1)) },
    })
    if (opponentOfBase) {
      const opponentMulliganBase = coinMulligan(animBase)
      entries.push({
        id: 'anim:mulligan-opp',
        group: 'Animaciones',
        label: 'Mulligan: the opponent takes one',
        description: `The server only sends the opponent's hand count, which a mulligan leaves the same: "Replay" feeds "${opponentOfBase.name} decides to take mulligan" and four face-down cards go from their hand to their library, then four come back.`,
        phase: 'game',
        game: opponentMulliganBase,
        gameId,
        action: { label: 'Replay', run: announce(`${logName(opponentOfBase.name)} decides to take mulligan`) },
      })
    }
    const dayBase = withDayNight(animBase, false)
    entries.push({
      id: 'anim:day-night',
      group: 'Animaciones',
      label: 'Day / night: it becomes night (new table, top bar)',
      description: 'It is day. "Replay" makes it night: a dusk sky washes across the top bar from right to left, the chip glows purple and the moon rises into it.',
      phase: 'game',
      game: dayBase,
      gameId,
      gameUi: 'v2',
      action: { label: 'Replay', run: replayQuiet(dayBase, gameId, (g) => withDayNight(g, true)) },
    })
    const nightBase = withDayNight(animBase, true)
    entries.push({
      id: 'anim:day-night-classic',
      group: 'Animaciones',
      label: 'Day / night: it becomes day (classic table, badge)',
      description: 'Classic table, where day/night is a badge on your info bar. It is night; "Replay" makes it day: the badge spins in as the sun and settles.',
      phase: 'game',
      game: nightBase,
      gameId,
      gameUi: 'v1',
      action: { label: 'Replay', run: replayQuiet(nightBase, gameId, (g) => withDayNight(g, false)) },
    })
    entries.push({
      id: 'anim:sacrifice',
      group: 'Animaciones',
      label: 'Sacrifice: a distinct death',
      description: `"Replay" feeds "${meName} sacrificed ${mysticName}" and then moves it to your graveyard: instead of the ember burn of a destroy, a blood-red sigil closes in, the card drains from the top and drops fall as it flies, darkening, to the graveyard.`,
      phase: 'game',
      game: animBase,
      gameId,
      action: { label: 'Replay', run: replayQuietWithLog(animBase, gameId, () => `${logName(meName)} sacrificed ${logObject(mystic, mysticName)} (source: ${logName('Village Rites')})`, (g) => sendToGraveyard(g, mystic)) },
    })
    const copyBase = { ...animBase, stack: { [COPIED_BOLT_ID]: bolt(COPIED_BOLT_ID, meOfBase) } as GameView['stack'] }
    entries.push({
      id: 'anim:spell-copy',
      group: 'Animaciones',
      label: 'Stack: a spell is copied',
      description: 'Your Lightning Bolt is on the stack. "Replay" adds a copy of it (no card leaves a hand): two blue echoes ripple out of the original and the copy peels off it, pale and translucent, onto the top of the stack.',
      phase: 'game',
      game: copyBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(copyBase, gameId, copyBolt) },
    })
    const ultimateBase = withLoyalty(animBase, mystic, 8)
    entries.push({
      id: 'anim:pw-ultimate',
      group: 'Animaciones',
      label: 'Planeswalker: ultimate (−7)',
      description: 'A planeswalker at 8 loyalty. "Replay" pays a −7: on top of the loyalty pulse, purple rays and a shockwave burst out of it, sparks fly across the board, the board shakes and the epic impact plays.',
      phase: 'game',
      game: ultimateBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(ultimateBase, gameId, (g) => withLoyalty(g, mystic, 1)) },
    })
    const revealIds = battlefieldIds(meOfBase).slice(0, 3)
    entries.push({
      id: 'anim:revealed-flip',
      group: 'Animaciones',
      label: 'Revealed cards: they flip in as the viewer opens',
      description: '"Replay" reveals three cards: the viewer opens and each card turns face up in turn, edge-on to face-on with a brief flash. Close the viewer or press "Replay" again.',
      phase: 'game',
      game: animBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(animBase, gameId, (g) => withRevealed(g, revealIds, meOfBase)) },
    })
    const coinPre = coinPregame(animBase)
    entries.push({
      id: 'anim:coin-flip',
      group: 'Animaciones',
      label: 'Coin flip: who plays first',
      description: 'Starts at turn 0 with the mulligan over; nothing runs on mount. "Replay" feeds the real server order: a turn-1 view with no phase (mulligan), then the turn-1 upkeep with the opponent active. A coin spins at the centre, lands showing that player, then the turn banner follows.',
      phase: 'game',
      game: coinPre,
      gameId: COIN_GAME_ID,
      action: { label: 'Replay', run: replayCoinFlip(coinPre, coinMulligan(animBase), coinFirstTurn(animBase, opponentOfBase)) },
    })
    entries.push({
      id: 'anim:land-slide',
      group: 'Animaciones',
      label: 'Land: slide (A1 land)',
      description: 'Press to play a land from your hand: it rises to the middle of the screen, holds, then drops onto the battlefield (flight-land).',
      phase: 'game',
      game: animBase,
      gameId,
      action: { label: 'Jugar tierra', apply: playFirstLand },
    })
    entries.push({
      id: 'anim:creature-enter',
      group: 'Animaciones',
      label: 'Creature: enters from stack (lift and drop)',
      description: 'Press to resolve a creature spell: it leaves the stack, rises to the middle of the screen, holds, then drops onto the battlefield.',
      phase: 'game',
      game: withCreatureOnStack(animBase, me),
      gameId,
      action: { label: 'Resolver criatura', apply: resolveCreatureSpell },
    })
    entries.push({
      id: 'anim:opp-creature-enter',
      group: 'Animaciones',
      label: 'Opponent creature: enters from stack (lift and drop)',
      description: 'Press to resolve an opponent creature spell: it leaves the stack, rises to the middle of the screen, holds, then drops onto the opponent battlefield.',
      phase: 'game',
      game: withCreatureOnStack(animBase, opponentOfBase),
      gameId,
      action: { label: 'Resolver criatura rival', apply: resolveCreatureSpell },
    })
    entries.push({
      id: 'anim:legend-enter',
      group: 'Animaciones',
      label: 'Legendary creature: gold foil sheen',
      description: 'Press to resolve a legendary creature: it rises with a gold foil sheen and drops onto the battlefield. No ring, no impact.',
      phase: 'game',
      game: withCreatureOnStack(animBase, me, { name: 'Omnath, Locus of Creation', superTypes: ['Legendary'], rarity: 'RARE' }),
      gameId,
      action: { label: 'Resolver legendaria', apply: resolveCreatureSpell },
    })
    entries.push({
      id: 'anim:mythic-enter',
      group: 'Animaciones',
      label: 'Mythic creature: ember foil, gold ring and impact',
      description: 'Press to resolve a mythic creature: ember border and gold shadow while it rises, then on landing a gold ring spreads out and the heavy impact plays.',
      phase: 'game',
      game: withCreatureOnStack(animBase, me, { name: 'Omnath, Locus of Creation', superTypes: ['Legendary'], rarity: 'MYTHIC' }),
      gameId,
      action: { label: 'Resolver mítica', apply: resolveCreatureSpell },
    })
    entries.push({
      id: 'anim:creature-damage',
      group: 'Animaciones',
      label: 'Creature: damage number (A3)',
      description: 'Press to deal 3 damage to your creature: a "-3" floats over it for about 700 ms.',
      phase: 'game',
      game: animBase,
      gameId,
      action: { label: 'Causar 3 de daño a criatura', apply: (g) => addDamage(g, mystic, 3) },
    })
    entries.push({
      id: 'anim:player-damage',
      group: 'Animaciones',
      label: 'Player: damage spell (A3, -3)',
      description: 'A Lightning Bolt leaves the stack while your life drops by 3: one "-3" inside your info bar.',
      phase: 'game',
      game: { ...animBase, stack: { 'gallery-bolt-stack': bolt('gallery-bolt-stack', opponentOfBase) } },
      gameId,
      action: { label: 'Resolver hechizo de daño', apply: (g) => resolveDamageSpellAtMe(g, 'gallery-bolt-stack', 3) },
    })
    entries.push({
      id: 'anim:player-life-loss',
      group: 'Animaciones',
      label: 'Player: life loss without spell (A3, none)',
      description: 'Life drops by 2 with no spell on the stack: no "-2" and no took-damage shake.',
      phase: 'game',
      game: animBase,
      gameId,
      action: { label: 'Perder 2 de vida (sin hechizo)', apply: (g) => loseLife(g, 2) },
    })
    entries.push({
      id: 'anim:chosen-target',
      group: 'Animaciones',
      label: 'Target: chosen creature (static)',
      description: 'A required target already chosen: static error border, no beacon. Shown on open, no action.',
      phase: 'game',
      game: animBase,
      gameId,
      feedback: (() => {
        const prompt = targetPrompt(animBase, gameId, true)
        return { ...prompt, chosenTargets: [prompt.options[0]?.id ?? ''] }
      })(),
    })
    entries.push({
      id: 'anim:opp-pill-required',
      group: 'Animaciones',
      label: 'Opponent pill: required target (beacon)',
      description: 'Required GAME_TARGET on an opponent player: the pill in the switcher pulses the gold beacon. Shown on open.',
      phase: 'game',
      game: fourPlayers,
      gameId,
      boardLayout: 'arena',
      feedback: targetPlayerPrompt(fourPlayers, gameId, opponentOfFour, true),
    })
    entries.push({
      id: 'anim:opp-pill-optional',
      group: 'Animaciones',
      label: 'Opponent pill: optional target (static)',
      description: 'Optional GAME_TARGET on an opponent player: the pill gets the static targetable border, no beacon. Shown on open.',
      phase: 'game',
      game: fourPlayers,
      gameId,
      boardLayout: 'arena',
      feedback: targetPlayerPrompt(fourPlayers, gameId, opponentOfFour, false),
    })
    const lungeBase = withStep(untapPermanent(animBase, mystic), 'COMBAT', 'BEGIN_COMBAT')
    entries.push({
      id: 'anim:attack-lunge',
      group: 'Animaciones',
      label: 'Combat: attacker lunges at the opponent',
      description: `"Replay" declares ${mysticName} as an attacker: it taps, springs towards the opponent with a brief flash, and settles a little forward of its row while it attacks.`,
      phase: 'game',
      game: lungeBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(lungeBase, gameId, (g) => declareAttacker(g, mystic)) },
    })
    const paidBase = withManaPool(animBase, { white: 1, blue: 1, red: 1 })
    entries.push({
      id: 'anim:mana-spent',
      group: 'Animaciones',
      label: 'Mana: spent on a spell',
      description: 'Your pool holds one white, one blue and one red mana. "Replay" casts a spell paid from it: three orbs in those colours leave the mana pool one after another and fly to the new spell on the stack.',
      phase: 'game',
      game: paidBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(paidBase, gameId, castPaidFromPool) },
    })
    const goadBase = withCardIcons(animBase, mystic, [])
    entries.push({
      id: 'anim:goad',
      group: 'Animaciones',
      label: 'Card icons: goad lands',
      description: `"Replay" goads ${mysticName}: the red restriction badge pops onto the card with a red ring and glow. Cards that already carry the badge when a game opens do not play it.`,
      phase: 'game',
      game: goadBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(goadBase, gameId, (g) => withCardIcons(g, mystic, [{ cardIconType: 'OTHER_HAS_RESTRICTIONS', text: '', hint: "Goaded by <font color='#20B2AA'>Opponent</font> (must attack)" }])) },
    })
    entries.push({
      id: 'anim:card-icon-gain',
      group: 'Animaciones',
      label: 'Card icons: an ability icon is gained',
      description: `"Replay" gives ${mysticName} flying: its ability icon pops in, a quiet version of the goad badge.`,
      phase: 'game',
      game: goadBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(goadBase, gameId, (g) => withCardIcons(g, mystic, [{ cardIconType: 'ABILITY_FLYING', text: '', hint: 'Flying' }])) },
    })
    const designationBase = withRules(animBase, mystic, ["ICON_BAD{this} isn't monstrous", "ICON_BAD{this} isn't renowned"])
    const classBase = withRules(animBase, mystic, ['Class level: 1'])
    const caseBase = withRules(animBase, mystic, ['ICON_BADCase is unsolved.'])
    entries.push({
      id: 'anim:designation-monstrous',
      group: 'Animaciones',
      label: 'Designations: becomes monstrous',
      description: `"Replay" makes ${mysticName} monstrous: the gold Monstrous badge pops in with a glow in its own colour and the card swells once. A card that is already monstrous when a game opens does not play it.`,
      phase: 'game',
      game: designationBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(designationBase, gameId, (g) => withRules(g, mystic, ['ICON_GOOD{this} is monstrous', "ICON_BAD{this} isn't renowned"])) },
    })
    entries.push({
      id: 'anim:designation-renowned',
      group: 'Animaciones',
      label: 'Designations: becomes renowned',
      description: `"Replay" makes ${mysticName} renowned: same pop, glow and swell as monstrous.`,
      phase: 'game',
      game: designationBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(designationBase, gameId, (g) => withRules(g, mystic, ["ICON_BAD{this} isn't monstrous", 'ICON_GOOD{this} is renowned'])) },
    })
    entries.push({
      id: 'anim:designation-suspected',
      group: 'Animaciones',
      label: 'Designations: suspected',
      description: `"Replay" suspects ${mysticName}: the red Suspected badge pops in, glows and jolts. The card does not swell.`,
      phase: 'game',
      game: designationBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(designationBase, gameId, (g) => withRules(g, mystic, ["ICON_BAD{this} isn't monstrous", "ICON_BAD{this} isn't renowned", "Suspected (has menace and can't block)"])) },
    })
    entries.push({
      id: 'anim:designation-classlevel',
      group: 'Animaciones',
      label: 'Designations: class level up',
      description: '"Replay" levels the class from 1 to 2: the level badge is replaced and pops in with a purple glow.',
      phase: 'game',
      game: classBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(classBase, gameId, (g) => withRules(g, mystic, ['Class level: 2'])) },
    })
    entries.push({
      id: 'anim:designation-casesolved',
      group: 'Animaciones',
      label: 'Designations: case solved',
      description: '"Replay" solves the case: the green Case solved badge pops in with a glow.',
      phase: 'game',
      game: caseBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(caseBase, gameId, (g) => withRules(g, mystic, ['ICON_GOODCase is solved.'])) },
    })
    const allIcons = ['FLYING', 'DEFENDER', 'DEATHTOUCH', 'LIFELINK', 'DOUBLE_STRIKE', 'FIRST_STRIKE', 'TRAMPLE', 'HEXPROOF', 'INFECT', 'INDESTRUCTIBLE', 'VIGILANCE', 'REACH']
    const badgesGame = withCardIcons(animBase, mystic, [
      ...allIcons.map((k) => ({ cardIconType: `ABILITY_${k}`, text: '', hint: k })),
      { cardIconType: 'OTHER_HAS_RESTRICTIONS', text: '', hint: "Goaded by <font color='#20B2AA'>Opponent</font> (must attack)" },
    ])
    entries.push({
      id: 'anim:card-badges',
      group: 'Animaciones',
      label: 'Card badges: glyphs and tooltips',
      description: `${mysticName} carries every ability icon the server can send, merged with its rules keywords into one glyph set (no duplicates, no emoji). Hover or tap a badge for its name and rules summary.`,
      phase: 'game',
      game: badgesGame,
      gameId,
      action: { label: 'Replay', run: replayQuiet(goadBase, gameId, () => badgesGame) },
    })
    const lowLibraryBase = withLibraryCount(animBase, meOfBase?.playerId, 4)
    entries.push({
      id: 'anim:library-low',
      group: 'Animaciones',
      label: 'Library: running low (3 cards)',
      description: 'The new-table library chip of your portrait. "Replay" draws your library from 4 to 3 cards: it starts to glow red and breathe, a steady state that stays while three cards or fewer remain.',
      phase: 'game',
      game: lowLibraryBase,
      gameId,
      gameUi: 'v2',
      action: { label: 'Replay', run: replayQuiet(lowLibraryBase, gameId, (g) => withLibraryCount(g, meOfBase?.playerId, 3)) },
    })
    const lastCardBase = withLibraryCount(animBase, meOfBase?.playerId, 1)
    entries.push({
      id: 'anim:library-empty',
      group: 'Animaciones',
      label: 'Library: runs out (new table)',
      description: 'The library chip of your portrait, down to its last card. "Replay" empties it: the chip shakes, a crack flashes across it in red and it stays outlined in red at 0.',
      phase: 'game',
      game: lastCardBase,
      gameId,
      gameUi: 'v2',
      action: { label: 'Replay', run: replayQuiet(lastCardBase, gameId, (g) => withLibraryCount(g, meOfBase?.playerId, 0)) },
    })
    entries.push({
      id: 'anim:library-empty-classic',
      group: 'Animaciones',
      label: 'Library: runs out (classic pile)',
      description: 'The classic table, where the library is a pile: "Replay" takes its last card, and the pile shakes, cracks in red and stays outlined in red at 0.',
      phase: 'game',
      game: lastCardBase,
      gameId,
      gameUi: 'v1',
      action: { label: 'Replay', run: replayQuiet(lastCardBase, gameId, (g) => withLibraryCount(g, meOfBase?.playerId, 0)) },
    })
    const attackedBase = withOpponentAttacker(animBase, mystic)
    entries.push({
      id: 'anim:block-lunge',
      group: 'Animaciones',
      label: 'Combat: your blocker steps up to the attacker',
      description: `The opponent attacks you. "Replay" blocks with ${mysticName}: it steps up the board towards the attacker with a brief cyan flash and stays a little forward while it blocks.`,
      phase: 'game',
      game: attackedBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(attackedBase, gameId, (g) => declareBlocker(g, mystic)) },
    })
    const opponentHeldBack = mapOpponent(withOpponentAttacker(animBase, mystic), (p) => ({
      ...p,
      battlefield: { ...p.battlefield, [GALLERY_OPP_ATTACKER_ID]: { ...p.battlefield?.[GALLERY_OPP_ATTACKER_ID], tapped: false } },
    }))
    const heldBack = {
      ...mapControlled(opponentHeldBack, (p) => ({ ...p, battlefield: { ...p.battlefield, [mystic]: { ...p.battlefield?.[mystic], tapped: true } } })),
      combat: [{ attackers: { [mystic]: {} }, blockers: {}, isBlocked: false, defenderId: opponentOfBase?.playerId }] as unknown as GameView['combat'],
    }
    entries.push({
      id: 'anim:block-lunge-opp',
      group: 'Animaciones',
      label: 'Combat: their blocker steps down to your attacker',
      description: `You attack with ${mysticName}. "Replay" has the opponent block with their creature: it steps down the board towards your attacker, mirroring yours.`,
      phase: 'game',
      game: heldBack,
      gameId,
      action: { label: 'Replay', run: replayQuiet(heldBack, gameId, (g) => declareBlocker(g, GALLERY_OPP_ATTACKER_ID)) },
    })
    const strikesBase = withTwoAttackers(game)
    entries.push({
      id: 'anim:combat-strikes',
      group: 'Animaciones',
      label: 'Combat: sequential strikes, then the deaths',
      description: 'Declare-blockers step: your Elvish Mystic is blocked by theirs and your Grizzly Bears is unblocked. "Replay" moves to combat damage: the Mystic lunges into its blocker, then the Bears into the opponent, each with sparks and a shake on impact and the opponent\'s -2 on the second; only after the last strike do both Mystics fly to their graveyards.',
      phase: 'game',
      game: strikesBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(strikesBase, gameId, dealCombatDamage) },
    })
    const kwFxFirstStrikeBase = kwFxBase(game, kwFxCombat(game, [KWFX_KNIGHT_ID], []), { [KWFX_KNIGHT_ID]: kwFxPermanent(KWFX_KNIGHT_ID, KWFX_KNIGHT, true) }, {})
    entries.push({
      id: 'anim:kw-first-strike',
      group: 'Animaciones',
      label: 'Keyword: first strike slash',
      description: '"Replay" moves to the first-strike damage step: the unblocked White Knight lands a bright slash across the opponent before regular damage, and their life drops by 2.',
      phase: 'game',
      game: kwFxFirstStrikeBase,
      gameId,
      action: {
        label: 'Replay',
        run: replayQuiet(kwFxFirstStrikeBase, gameId, (g) => withStep(mapOpponent(g, (p) => ({ ...p, life: (p.life ?? 0) - 2 })), 'COMBAT', 'FIRST_COMBAT_DAMAGE')),
      },
    })
    const kwFxDeathtouchBase = kwFxBase(
      game,
      kwFxCombat(game, [KWFX_RATS_ID], [KWFX_DEATHTOUCH_BLOCKER_ID]),
      { [KWFX_RATS_ID]: kwFxPermanent(KWFX_RATS_ID, KEYWORD_AURA_CREATURES.deathtouch, true) },
      { [KWFX_DEATHTOUCH_BLOCKER_ID]: kwFxPermanent(KWFX_DEATHTOUCH_BLOCKER_ID, KEYWORD_AURA_CREATURES.trample, false) },
    )
    entries.push({
      id: 'anim:kw-deathtouch',
      group: 'Animaciones',
      label: 'Keyword: deathtouch kills its blocker',
      description: '"Replay" deals combat damage: your Typhoid Rats, blocked by the Colossal Dreadmaw, kills it with deathtouch, a skull ring and motes mark the hit, and both creatures go to their graveyards.',
      phase: 'game',
      game: kwFxDeathtouchBase,
      gameId,
      action: {
        label: 'Replay',
        run: replayQuiet(kwFxDeathtouchBase, gameId, (g) => ({
          ...toGraveyards(withStep(g, 'COMBAT', 'COMBAT_DAMAGE'), [KWFX_RATS_ID, KWFX_DEATHTOUCH_BLOCKER_ID]),
          combat: [] as unknown as GameView['combat'],
        })),
      },
    })
    const kwFxLifelinkBase = kwFxBase(game, kwFxCombat(game, [KWFX_CHILD_ID], []), { [KWFX_CHILD_ID]: kwFxPermanent(KWFX_CHILD_ID, KEYWORD_AURA_CREATURES.lifelink, true) }, {})
    entries.push({
      id: 'anim:kw-lifelink',
      group: 'Animaciones',
      label: 'Keyword: lifelink motes flow to your life',
      description: '"Replay" deals combat damage: the unblocked Child of Night sends motes flying from its card to your portrait, your life goes up by 2 and the opponent\'s down by 2.',
      phase: 'game',
      game: kwFxLifelinkBase,
      gameId,
      action: {
        label: 'Replay',
        run: replayQuiet(kwFxLifelinkBase, gameId, (g) => withLifeDelta(withLifeDelta(withStep(g, 'COMBAT', 'COMBAT_DAMAGE'), 'me', 2), 'opponent', -2)),
      },
    })
    const kwFxTrampleBase = kwFxBase(
      game,
      kwFxCombat(game, [KWFX_DREADMAW_ID], [KWFX_BEARS_ID]),
      { [KWFX_DREADMAW_ID]: kwFxPermanent(KWFX_DREADMAW_ID, KEYWORD_AURA_CREATURES.trample, true) },
      { [KWFX_BEARS_ID]: kwFxPermanent(KWFX_BEARS_ID, KWFX_BEARS, false) },
    )
    entries.push({
      id: 'anim:kw-trample',
      group: 'Animaciones',
      label: 'Keyword: trample overflow reaches the player',
      description: '"Replay" deals combat damage: the Colossal Dreadmaw kills the blocking Grizzly Bears, and the 4 damage that does not fit becomes a wave that crosses to the opponent, whose life drops by 4; the Dreadmaw keeps 2 damage.',
      phase: 'game',
      game: kwFxTrampleBase,
      gameId,
      action: {
        label: 'Replay',
        run: replayQuiet(kwFxTrampleBase, gameId, (g) => ({
          ...withLifeDelta(toGraveyards(addDamage(withStep(g, 'COMBAT', 'COMBAT_DAMAGE'), KWFX_DREADMAW_ID, 2), [KWFX_BEARS_ID]), 'opponent', -4),
          combat: [] as unknown as GameView['combat'],
        })),
      },
    })
    const kwFxIndestructibleBase = mapControlled(animBase, (p) => ({
      ...p,
      battlefield: { ...p.battlefield, [KWFX_MYR_ID]: kwFxPermanent(KWFX_MYR_ID, KEYWORD_AURA_CREATURES.indestructible, false) },
    }))
    entries.push({
      id: 'anim:kw-indestructible',
      group: 'Animaciones',
      label: 'Keyword: indestructible shrugs off lethal damage',
      description: '"Replay" puts 3 damage on your Darksteel Myr, a 0/1 with indestructible: the damage reaches its toughness, an indestructible burst marks it, and it stays on the battlefield.',
      phase: 'game',
      game: kwFxIndestructibleBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(kwFxIndestructibleBase, gameId, (g) => addDamage(g, KWFX_MYR_ID, 3)) },
    })
    const kwFxBlockerDeathtouchBase = kwFxBase(
      game,
      kwFxCombat(game, [KWFX_BEARS_ID], [KWFX_BLOCKING_RATS_ID]),
      { [KWFX_BEARS_ID]: kwFxPermanent(KWFX_BEARS_ID, KWFX_BEARS, true) },
      { [KWFX_BLOCKING_RATS_ID]: kwFxPermanent(KWFX_BLOCKING_RATS_ID, KEYWORD_AURA_CREATURES.deathtouch, false) },
    )
    entries.push({
      id: 'anim:kw-blocker-deathtouch',
      group: 'Animaciones',
      label: 'Keyword: deathtouch blocker kills my attacker',
      description: '"Replay" deals combat damage: your Grizzly Bears, blocked by the Typhoid Rats, is killed by the Rats\' deathtouch, a skull ring marks the hit, and the Rats die to the Bears\' 2 damage; both go to their graveyards.',
      phase: 'game',
      game: kwFxBlockerDeathtouchBase,
      gameId,
      action: {
        label: 'Replay',
        run: replayQuiet(kwFxBlockerDeathtouchBase, gameId, (g) => ({
          ...toGraveyards(withStep(g, 'COMBAT', 'COMBAT_DAMAGE'), [KWFX_BEARS_ID, KWFX_BLOCKING_RATS_ID]),
          combat: [] as unknown as GameView['combat'],
        })),
      },
    })
    const kwFxDoubleBlockBase = kwFxBase(
      game,
      kwFxCombat(game, [KWFX_VIPER_ID], [KWFX_BEARS_OPP_1_ID, KWFX_BEARS_OPP_2_ID]),
      { [KWFX_VIPER_ID]: kwFxPermanent(KWFX_VIPER_ID, KWFX_VIPER, true) },
      {
        [KWFX_BEARS_OPP_1_ID]: kwFxPermanent(KWFX_BEARS_OPP_1_ID, KWFX_BEARS, false),
        [KWFX_BEARS_OPP_2_ID]: kwFxPermanent(KWFX_BEARS_OPP_2_ID, KWFX_BEARS, false),
      },
    )
    entries.push({
      id: 'anim:kw-double-block-deathtouch',
      group: 'Animaciones',
      label: 'Keyword: deathtouch kills two blockers',
      description: '"Replay" deals combat damage: your Deadly Viper, double-blocked by two Grizzly Bears, kills both with deathtouch, a skull ring marks each of them, and the Viper dies to their 4 damage; all three go to their graveyards.',
      phase: 'game',
      game: kwFxDoubleBlockBase,
      gameId,
      action: {
        label: 'Replay',
        run: replayQuiet(kwFxDoubleBlockBase, gameId, (g) => ({
          ...toGraveyards(withStep(g, 'COMBAT', 'COMBAT_DAMAGE'), [KWFX_VIPER_ID, KWFX_BEARS_OPP_1_ID, KWFX_BEARS_OPP_2_ID]),
          combat: [] as unknown as GameView['combat'],
        })),
      },
    })
    const kwFxWalkerBase = kwFxBase(
      game,
      { ...kwFxCombat(game, [KWFX_DREADMAW_ID], [KWFX_BEARS_ID]), defenderId: KWFX_WALKER_ID, defenderName: 'Ember Oracle' },
      { [KWFX_DREADMAW_ID]: kwFxPermanent(KWFX_DREADMAW_ID, KEYWORD_AURA_CREATURES.trample, true) },
      { [KWFX_BEARS_ID]: kwFxPermanent(KWFX_BEARS_ID, KWFX_BEARS, false), [KWFX_WALKER_ID]: kwFxWalker(KWFX_WALKER_ID, '5') },
    )
    entries.push({
      id: 'anim:kw-trample-planeswalker',
      group: 'Animaciones',
      label: 'Keyword: trample overflow hits a planeswalker',
      description: '"Replay" deals combat damage: the Colossal Dreadmaw kills the blocking Grizzly Bears, and the 4 damage that does not fit becomes a wave that crosses to Ember Oracle, whose loyalty drops from 5 to 1; the Dreadmaw keeps 2 damage.',
      phase: 'game',
      game: kwFxWalkerBase,
      gameId,
      action: {
        label: 'Replay',
        run: replayQuiet(kwFxWalkerBase, gameId, (g) => ({
          ...mapOpponent(toGraveyards(addDamage(withStep(g, 'COMBAT', 'COMBAT_DAMAGE'), KWFX_DREADMAW_ID, 2), [KWFX_BEARS_ID]), (p) => ({
            ...p,
            battlefield: { ...p.battlefield, [KWFX_WALKER_ID]: kwFxWalker(KWFX_WALKER_ID, '1') },
          })),
          combat: [] as unknown as GameView['combat'],
        })),
      },
    })
    entries.push({
      id: 'anim:destroy',
      group: 'Animaciones',
      label: 'Destroy: ember burn on the way to the graveyard',
      description: `"Replay" destroys ${mysticName}: embers and a scorch burst where it stood and the card flies, burning, to your graveyard (the slot itself dissolves).`,
      phase: 'game',
      game: animBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(animBase, gameId, (g) => sendToGraveyard(g, mystic)) },
    })
    entries.push({
      id: 'anim:exile',
      group: 'Animaciones',
      label: 'Exile: white flash and flight to the exile pile (classic table)',
      description: `Classic table. "Replay" exiles ${mysticName}: a white flash bursts where it stood and the card flies, pale, to your exile pile.`,
      phase: 'game',
      game: animBase,
      gameId,
      gameUi: 'v1',
      action: { label: 'Replay', run: replayQuiet(animBase, gameId, (g) => sendToExile(g, mystic)) },
    })
    entries.push({
      id: 'anim:discard',
      group: 'Animaciones',
      label: 'Discard: a card flies from your hand to the graveyard',
      description: '"Replay" discards the first card of your hand: it leaves the hand and flies to your graveyard, and the graveyard count flashes +1.',
      phase: 'game',
      game: animBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(animBase, gameId, discardFirstCard) },
    })
    const tokenBase = withFadingToken(animBase)
    entries.push({
      id: 'anim:token-fade',
      group: 'Animaciones',
      label: 'Token: fades away when it leaves the battlefield',
      description: 'A Spirit token is on your battlefield. "Replay" removes it (a token that leaves goes to no zone): a puff fades out where it stood, with no flight to the graveyard.',
      phase: 'game',
      game: tokenBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(tokenBase, gameId, (g) => removeFromBattlefield(g, GALLERY_FADING_TOKEN_ID)) },
    })
    const reanimateBase = sendToGraveyard(animBase, mystic)
    entries.push({
      id: 'anim:reanimate',
      group: 'Animaciones',
      label: 'Reanimate: a creature returns from the graveyard',
      description: `${mysticName} starts in your graveyard. "Replay" returns it to the battlefield: it lifts out of the graveyard pile, not your hand, holds and drops onto its row.`,
      phase: 'game',
      game: reanimateBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(reanimateBase, gameId, (g) => returnFromGraveyard(g, mystic)) },
    })
    entries.push({
      id: 'anim:exile-v2',
      group: 'Animaciones',
      label: 'Exile: white flash and flight to the exile chip (new table)',
      description: `New table. "Replay" exiles ${mysticName}: a white flash bursts where it stood and the card flies, pale, to the exile chip of your portrait.`,
      phase: 'game',
      game: animBase,
      gameId,
      gameUi: 'v2',
      action: { label: 'Replay', run: replayQuiet(animBase, gameId, (g) => sendToExile(g, mystic)) },
    })
    const ptGame = untapPermanent(animBase, mystic)
    const ptBase = ptOf(ptGame, mystic)
    entries.push({
      id: 'anim:pt-pump',
      group: 'Animaciones',
      label: 'P/T: a pump pops the box green',
      description: `"Replay" gives ${mysticName} +3/+3 until end of turn (no counters): its P/T box pops and flashes green and "+3/+3" floats up from it.`,
      phase: 'game',
      game: ptGame,
      gameId,
      action: { label: 'Replay', run: replayQuiet(ptGame, gameId, (g) => withPt(g, mystic, ptBase.power + 3, ptBase.toughness + 3)) },
    })
    const pumpedBase = withPt(ptGame, mystic, ptBase.power + 2, ptBase.toughness + 2)
    entries.push({
      id: 'anim:pt-shrink',
      group: 'Animaciones',
      label: 'P/T: a shrink pops the box red',
      description: `${mysticName} starts at +2/+2. "Replay" gives it -2/-2: its P/T box pops and flashes red and "-2/-2" floats up from it.`,
      phase: 'game',
      game: pumpedBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(pumpedBase, gameId, (g) => withPt(g, mystic, ptBase.power, ptBase.toughness)) },
    })
    entries.push({
      id: 'anim:pt-mixed',
      group: 'Animaciones',
      label: 'P/T: a mixed change pops the box gold',
      description: `${mysticName} starts at +2/+2. "Replay" gives it +2/-1: its P/T box pops and flashes gold and "+2/-1" floats up from it.`,
      phase: 'game',
      game: pumpedBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(pumpedBase, gameId, (g) => withPt(g, mystic, ptBase.power + 4, ptBase.toughness + 1)) },
    })
    entries.push({
      id: 'anim:regrowth',
      group: 'Animaciones',
      label: 'Regrowth: a card returns from your graveyard to your hand',
      description: `${mysticName} starts in your graveyard. "Replay" returns it to your hand: it flies out of the graveyard pile into the hand, not from the library.`,
      phase: 'game',
      game: reanimateBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(reanimateBase, gameId, (g) => returnGraveyardToHand(g, mystic)) },
    })
    if (opponentOfBase) {
      const oppGraveBase = withOpponentGraveyardCard(animBase, opponentOfBase)
      entries.push({
        id: 'anim:opp-regrowth',
        group: 'Animaciones',
        label: 'Regrowth: an opponent card returns from their graveyard to their hand',
        description: `Grizzly Bears is in ${opponentOfBase.name}'s graveyard. "Replay" returns it to their hand (the server only sends their hand count): it flies face up out of their graveyard pile to their hand, with no face-down draw from the library.`,
        phase: 'game',
        game: oppGraveBase,
        gameId,
        action: { label: 'Replay', run: replayQuiet(oppGraveBase, gameId, (g) => opponentRegrowth(g, opponentOfBase)) },
      })
    }
    entries.push({
      id: 'anim:exile-from-hand',
      group: 'Animaciones',
      label: 'Exile from hand: a card flies from your hand to the exile pile',
      description: '"Replay" exiles the first card of your hand (foretell, an exile-from-hand cost): it leaves the hand with a white flash and flies, pale, to your exile pile.',
      phase: 'game',
      game: animBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(animBase, gameId, exileFirstHandCard) },
    })
    const delveBase = withDelveGraveyard(animBase)
    entries.push({
      id: 'anim:exile-from-graveyard',
      group: 'Animaciones',
      label: 'Exile from graveyard: delve exiles three cards',
      description: '"Replay" delves three cards of your graveyard: one after another they flash white on the graveyard pile and fly, pale, to your exile pile.',
      phase: 'game',
      game: delveBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(delveBase, gameId, delveThree) },
    })
    entries.push({
      id: 'anim:exile-from-library',
      group: 'Animaciones',
      label: 'Exile from library: impulse draw turns the top card face up',
      description: '"Replay" exiles the top card of your library (impulse draw, cascade): it leaves the library face down with a white flash, turns face up halfway and lands, pale, on your exile pile.',
      phase: 'game',
      game: animBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(animBase, gameId, exileTopOfLibrary) },
    })
    const flashbackBase = withMyPriority(withInPile(animBase, 'graveyard', faithlessLooting(FLASHBACK_ID, meOfBase)))
    entries.push({
      id: 'anim:flashback',
      group: 'Animaciones',
      label: 'Flashback: a spell is cast from your graveyard',
      description: 'Faithless Looting is in your graveyard. "Replay" casts it with flashback: it lifts out of the graveyard pile (not your hand) to the middle of the screen, holds, then flies to the stack with the gold trail.',
      phase: 'game',
      game: flashbackBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(flashbackBase, gameId, (g) => castFromMyPile(g, 'graveyard', FLASHBACK_ID)) },
    })
    const impulseBase = withMyPriority(withInPile(animBase, 'exile', { ...bolt(IMPULSE_ID, meOfBase), id: IMPULSE_ID }))
    entries.push({
      id: 'anim:cast-from-exile',
      group: 'Animaciones',
      label: 'Cast from exile: an impulse-drawn spell leaves the exile pile',
      description: 'A Lightning Bolt you exiled with impulse draw is in your exile. "Replay" casts it: it lifts out of the exile pile (not your hand) to the middle of the screen, holds, then flies to the stack with the gold trail.',
      phase: 'game',
      game: impulseBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(impulseBase, gameId, (g) => castFromMyPile(g, 'exile', IMPULSE_ID)) },
    })
    const wrathBase = withMyPriority(withWrathOnStack(withWipeCrowd(animBase)))
    entries.push({
      id: 'anim:board-wipe',
      group: 'Animaciones',
      label: 'Board wipe: Wrath of God sweeps the board',
      description: 'Wrath of God is on the stack and both players have creatures. "Replay" resolves it: the board darkens and shakes, one wave of white-gold light sweeps it from left to right, and each creature burns and flies to its graveyard as the wave reaches it, so the whole Wrath reads as one event.',
      phase: 'game',
      game: wrathBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(wrathBase, gameId, resolveWrath) },
    })
    const wipePodBase = withMyPriority(withWrathOnStack(podBase))
    entries.push({
      id: 'anim:board-wipe-pod',
      group: 'Animaciones',
      label: 'Board wipe: Wrath of God in a four-player pod',
      description: 'Four-player pod. "Replay" resolves Wrath of God: the wave crosses every seat at once while the board shakes, and the creatures of all four players die in its wake, left to right.',
      phase: 'game',
      game: wipePodBase,
      gameId,
      boardLayout: 'pod',
      action: { label: 'Replay', run: replayQuiet(wipePodBase, gameId, resolveWrath) },
    })
    const faceUpLabels: Record<GalleryFaceDown, { label: string; description: string }> = {
      morph: {
        label: 'Morph: a face-down creature is turned face up',
        description: 'A face-down 2/2 (morph) is on your battlefield. "Replay" turns it face up: a dark shroud closes over it while it turns edge-on, then Den Protector comes round lit, a green burst and ring spreading from it.',
      },
      manifest: {
        label: 'Manifest: a manifested card is turned face up',
        description: 'A manifested face-down 2/2 is on your battlefield. "Replay" turns it face up: it darkens and turns edge-on, then Elite Vanguard comes round out of the shadow with a white-gold burst and ring.',
      },
    }
    for (const kind of ['morph', 'manifest'] as const) {
      const faceDownBase = withFaceDown(animBase, kind)
      entries.push({
        id: `anim:${kind}-face-up`,
        group: 'Animaciones',
        label: faceUpLabels[kind].label,
        description: faceUpLabels[kind].description,
        phase: 'game',
        game: faceDownBase,
        gameId,
        action: { label: 'Replay', run: replayQuiet(faceDownBase, gameId, (g) => turnFaceUp(g, kind)) },
      })
    }
    const oppIdOfBase = opponentOfBase?.playerId
    const myIdOfBase = meOfBase?.playerId
    const poisonBase = withPlayerCounter(animBase, oppIdOfBase, 'poison', 2)
    entries.push({
      id: 'anim:poison',
      group: 'Animaciones',
      label: 'Poison: the opponent gets a poison counter',
      description: 'The opponent has 2 poison counters. "Replay" gives them a third (infect, toxic): the poison badge on their info bar pops and flashes toxic green, a ring spreads, green drops drip off it and a green "+1" floats up while the number ticks.',
      phase: 'game',
      game: poisonBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(poisonBase, gameId, (g) => withPlayerCounter(g, oppIdOfBase, 'poison', 3)) },
    })
    const nearLethalBase = withPlayerCounter(animBase, oppIdOfBase, 'poison', 9)
    entries.push({
      id: 'anim:poison-lethal',
      group: 'Animaciones',
      label: 'Poison: the tenth poison counter',
      description: 'The opponent has 9 poison counters. "Replay" gives them the tenth: on top of the badge pulse and drip, a toxic cloud bursts over their seat with a green shockwave, the board shakes, and the badge keeps glowing green.',
      phase: 'game',
      game: nearLethalBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(nearLethalBase, gameId, (g) => withPlayerCounter(g, oppIdOfBase, 'poison', 10)) },
    })
    const podPoisoned = podVictim?.playerId
    const podPoisonBase = withPlayerCounter(podBase, podPoisoned, 'poison', 4)
    entries.push({
      id: 'anim:poison-pod',
      group: 'Animaciones',
      label: 'Poison: a pod opponent gets a poison counter',
      description: 'Four-player pod. "Replay" gives one opponent a fifth poison counter: their seat\'s poison chip pops toxic green, drips and floats a green "+1".',
      phase: 'game',
      game: podPoisonBase,
      gameId,
      boardLayout: 'pod',
      action: { label: 'Replay', run: replayQuiet(podPoisonBase, gameId, (g) => withPlayerCounter(g, podPoisoned, 'poison', 5)) },
    })
    const energyBase = withPlayerCounter(animBase, myIdOfBase, 'energy', 1)
    entries.push({
      id: 'anim:energy',
      group: 'Animaciones',
      label: 'Energy: you get two energy counters',
      description: 'You have 1 energy. "Replay" gives you two more: the energy badge pops and flashes yellow, a yellow bolt cracks over it with sparks, the bolt icon jolts and a yellow "+2" floats up while the number ticks to 3.',
      phase: 'game',
      game: energyBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(energyBase, gameId, (g) => withPlayerCounter(g, myIdOfBase, 'energy', 3)) },
    })
    const experienceBase = withPlayerCounter(animBase, myIdOfBase, 'experience', 1)
    entries.push({
      id: 'anim:player-counter',
      group: 'Animaciones',
      label: 'Player counter: an experience counter (generic pulse)',
      description: 'You have 1 experience counter. "Replay" gives you another: like any other player counter (rad, ticket…), its badge pops with a purple flash and a ring, the number ticks to 2 and a "+1" floats up.',
      phase: 'game',
      game: experienceBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(experienceBase, gameId, (g) => withPlayerCounter(g, myIdOfBase, 'experience', 2)) },
    })
    const speedBase = withPlayerCounter(animBase, myIdOfBase, 'speed', 1)
    entries.push({
      id: 'anim:speed',
      group: 'Animaciones',
      label: 'Speed: your speed goes up',
      description: 'Your speed is 1. "Replay" raises it to 2: the speed chip (a badge on the new table, a counter on the classic one) pops with an ember flash and a ring, and a "+1" floats up.',
      phase: 'game',
      game: speedBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(speedBase, gameId, (g) => withPlayerCounter(g, myIdOfBase, 'speed', 2)) },
    })
    const stolenId = opponentNonLandId(opponentOfBase)
    if (stolenId && myIdOfBase && oppIdOfBase) {
      entries.push({
        id: 'anim:gain-control',
        group: 'Animaciones',
        label: 'Gain control: you take an opponent\'s creature (Threaten)',
        description: '"Replay" gains control of an opponent\'s creature, as Threaten does: a tether in your seat colour seizes it where it stood, a ring marks its new slot on your side, and the tether reels it across into your battlefield, glowing your colour, instead of the ordinary lift-and-drop entry.',
        phase: 'game',
        game: animBase,
        gameId,
        action: { label: 'Replay', run: replayQuiet(animBase, gameId, (g) => withControl(g, stolenId, myIdOfBase)) },
      })
      const stolenBase = withControl(animBase, stolenId, myIdOfBase)
      entries.push({
        id: 'anim:control-return',
        group: 'Animaciones',
        label: 'Control returns: the creature goes back to its owner',
        description: 'The opponent\'s creature is on your battlefield. "Replay" ends the effect (end of turn): a tether in the opponent\'s seat colour pulls it back across to their side.',
        phase: 'game',
        game: stolenBase,
        gameId,
        action: { label: 'Replay', run: replayQuiet(stolenBase, gameId, (g) => withControl(g, stolenId, oppIdOfBase)) },
      })
    }
    const [podThief, podOwner] = players(podBase).filter((p) => !p.controlled)
    const podStolenId = opponentNonLandId(podOwner)
    if (podThief && podStolenId) {
      entries.push({
        id: 'anim:gain-control-pod',
        group: 'Animaciones',
        label: 'Gain control: one pod opponent steals from another',
        description: `Four-player pod. "Replay" gives ${podThief.name} control of a creature of ${podOwner.name}: a tether in ${podThief.name}'s seat colour reels it from one opponent's seat into the other's.`,
        phase: 'game',
        game: podBase,
        gameId,
        boardLayout: 'pod',
        action: { label: 'Replay', run: replayQuiet(podBase, gameId, (g) => withControl(g, podStolenId, podThief.playerId)) },
      })
    }
    entries.push({
      id: 'anim:tuck',
      group: 'Animaciones',
      label: 'Put on the library: your permanent is tucked (new table)',
      description: `"Replay" puts ${mysticName} into your library, as Chaos Warp does: a cool vortex draws it down where it stood, and it flies to the library chip of your portrait, turning face down on the way.`,
      phase: 'game',
      game: animBase,
      gameId,
      gameUi: 'v2',
      action: { label: 'Replay', run: replayQuiet(animBase, gameId, (g) => tuckPermanent(g, mystic)) },
    })
    entries.push({
      id: 'anim:tuck-classic',
      group: 'Animaciones',
      label: 'Put on the library: your permanent is tucked (classic table)',
      description: `Classic table, where the library is a pile of card backs: "Replay" tucks ${mysticName}; it sinks into the vortex and flies onto the pile, turning face down.`,
      phase: 'game',
      game: animBase,
      gameId,
      gameUi: 'v1',
      action: { label: 'Replay', run: replayQuiet(animBase, gameId, (g) => tuckPermanent(g, mystic)) },
    })
    entries.push({
      id: 'anim:hand-to-library',
      group: 'Animaciones',
      label: 'Put on the library: two hand cards go back (Brainstorm)',
      description: '"Replay" puts the first two cards of your hand back on top of your library, as Brainstorm does: one after the other they leave the hand face up and turn face down as they fly into the library.',
      phase: 'game',
      game: animBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(animBase, gameId, (g) => putBackFromHand(g, 2)) },
    })
    if (opponentOfBase) {
      const oppPutBackBase = withOpponentHandDelta(animBase, opponentOfBase, +2)
      entries.push({
        id: 'anim:opp-hand-to-library',
        group: 'Animaciones',
        label: 'Put on the library: the opponent puts two hand cards back (classic table)',
        description: `Classic table, where the opponent's hand is drawn as card backs. The server only sends ${opponentOfBase.name}'s hand and library counts: "Replay" shrinks the hand by two and grows the library by two, with nothing reaching a graveyard, an exile or the stack, and two face-down cards fly from their hand to their library pile.`,
        phase: 'game',
        game: oppPutBackBase,
        gameId,
        gameUi: 'v1',
        action: { label: 'Replay', run: replayQuiet(oppPutBackBase, gameId, (g) => opponentPutBack(g, opponentOfBase, 2)) },
      })
    }
    const rancorBase = withMyPriority(withRancorOnStack(animBase, mystic))
    entries.push({
      id: 'anim:aura-attach',
      group: 'Animaciones',
      label: 'Aura: Rancor enters attached to its host',
      description: `Rancor is on the stack, aimed at ${mysticName}. "Replay" resolves it: it lifts, holds and drops into its slot beside the creature, then a green thread of light binds it to ${mysticName}, a ring closes round the host and both glow green.`,
      phase: 'game',
      game: rancorBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(rancorBase, gameId, resolveRancor) },
    })
    entries.push({
      id: 'anim:aura-attach-classic',
      group: 'Animaciones',
      label: 'Aura: Rancor enters attached to its host (classic table)',
      description: 'The same Rancor on the classic table: it drops into its slot under the host and the green thread, ring and glow bind them.',
      phase: 'game',
      game: rancorBase,
      gameId,
      gameUi: 'v1',
      action: { label: 'Replay', run: replayQuiet(rancorBase, gameId, resolveRancor) },
    })
    const mutateBase = withMyPriority(withMutateOnStack(animBase))
    entries.push({
      id: 'anim:mutate',
      group: 'Animaciones',
      label: 'Mutate: Gemrazer merges over your creature',
      description: `Gemrazer is on the stack, cast for its mutate cost. "Replay" merges it over ${mysticName}: instead of leaving the stack for a graveyard, it flies down onto the creature, green ripples wobble out, the host squashes and swells as they merge, and the pile now shows Gemrazer on top with ${mysticName} under it.`,
      phase: 'game',
      game: mutateBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(mutateBase, gameId, (g) => mutateOnto(g, mystic, true)) },
    })
    entries.push({
      id: 'anim:mutate-under',
      group: 'Animaciones',
      label: 'Mutate: Gemrazer merges under your creature',
      description: `The same merge with Gemrazer put under ${mysticName}: it flies onto the creature and ripples, and the host keeps its face with Gemrazer peeking out beneath it.`,
      phase: 'game',
      game: mutateBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(mutateBase, gameId, (g) => mutateOnto(g, mystic, false)) },
    })
    const manland = landIds(meOfBase)[0] ?? ''
    const villageBase = withAnimatedLand(animBase, manland, false)
    const villageAnimated = withAnimatedLand(animBase, manland, true)
    entries.push({
      id: 'anim:land-animate',
      group: 'Animaciones',
      label: 'Animated land: a manland rises into the creature band (classic table)',
      description: 'Classic table. Treetop Village sits with your lands. "Replay" activates it: a column of green light lifts it where it stood, it flies up into the creature band and lands there lit green, a 3/3 Ape.',
      phase: 'game',
      game: villageBase,
      gameId,
      gameUi: 'v1',
      action: { label: 'Replay', run: replayQuiet(villageBase, gameId, (g) => withAnimatedLand(g, manland, true)) },
    })
    entries.push({
      id: 'anim:land-animate-v2',
      group: 'Animaciones',
      label: 'Animated land: a manland rises into the creature band (new table)',
      description: 'The same activation on the new table: Treetop Village leaves the land row in a column of green light and lands among your creatures, glowing.',
      phase: 'game',
      game: villageBase,
      gameId,
      gameUi: 'v2',
      action: { label: 'Replay', run: replayQuiet(villageBase, gameId, (g) => withAnimatedLand(g, manland, true)) },
    })
    entries.push({
      id: 'anim:land-unanimate',
      group: 'Animaciones',
      label: 'Animated land: the effect ends and it settles back',
      description: 'Treetop Village is a 3/3 Ape among your creatures. "Replay" ends the effect, as at end of turn: it flies back down to your lands, quicker and softer, and dims for a moment as it settles.',
      phase: 'game',
      game: villageAnimated,
      gameId,
      action: { label: 'Replay', run: replayQuiet(villageAnimated, gameId, (g) => withAnimatedLand(g, manland, false)) },
    })
    const copterBase = withVehicle(untapPermanent(animBase, mystic), mystic)
    entries.push({
      id: 'anim:vehicle-crew',
      group: 'Animaciones',
      label: "Vehicle crewed: Smuggler's Copter becomes a creature",
      description: `Smuggler's Copter sits with your other permanents. "Replay" crews it with ${mysticName}: the Mystic taps, the Copter rises in a column of gold light into the creature band and lands there glowing.`,
      phase: 'game',
      game: copterBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(copterBase, gameId, (g) => crewVehicle(g, mystic)) },
    })
    entries.push({
      id: 'anim:emblem',
      group: 'Animaciones',
      label: 'Emblem: it pops into the command zone',
      description: 'No emblem yet. "Replay" gives you Emblem Gideon, shaped as the server sends it: the command zone opens beside your creatures and the emblem pops in with a violet flash, two rings and gold sparks.',
      phase: 'game',
      game: animBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(animBase, gameId, (g) => withMyCommandItem(g, galleryEmblem())) },
    })
    const dungeonBase = withMyCommandItem(animBase, galleryDungeon('Cave Entrance'))
    entries.push({
      id: 'anim:dungeon',
      group: 'Animaciones',
      label: 'Dungeon: venturing into the next room',
      description: 'You are in Lost Mine of Phandelver, at Cave Entrance (the dungeon badge on your info bar). "Replay" ventures into Goblin Lair: the badge flares like a torch, a ring and embers rise from it and "Goblin Lair" floats up. The dungeon map in the mechanics panel lights the new room.',
      phase: 'game',
      game: dungeonBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(dungeonBase, gameId, (g) => withMyCommandItem(g, galleryDungeon('Goblin Lair'))) },
    })
    entries.push({
      id: 'anim:dungeon-complete',
      group: 'Animaciones',
      label: 'Dungeon: completed',
      description: 'You are in Lost Mine of Phandelver. "Replay" feeds the server\'s line "<you> has completed Lost Mine of Phandelver": the dungeon badge flares gold and bursts, embers rise and the dungeon\'s name floats up in a green box.',
      phase: 'game',
      game: dungeonBase,
      gameId,
      action: { label: 'Replay', run: announce(`${logName(meOfBase?.name ?? 'You')} has completed <font color='#B0C4DE'>Lost Mine of Phandelver</font>`) },
    })
    const planeBase = withPlane(animBase, 'gallery-plane-akoum', 'Plane - Akoum', AKOUM)
    entries.push({
      id: 'anim:planeswalk',
      group: 'Animaciones',
      label: 'Planechase: planeswalking rolls the new plane in',
      description: 'Akoum is the plane in your command zone. "Replay" planeswalks to Academy at Tolaria West: a planar portal swirls open over the command zone and the new plane rolls down into it out of the flash.',
      phase: 'game',
      game: planeBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(planeBase, gameId, (g) => withPlane(g, 'gallery-plane-tolaria', 'Plane - Academy at Tolaria West', TOLARIA_WEST)) },
    })
    entries.push({
      id: 'anim:hand-revealed',
      group: 'Animaciones',
      label: "Hand revealed: the opponent's hand fans out face up (classic table)",
      description: `Classic table. "Replay" lets you see three cards of ${opponentOfBase?.name ?? 'the opponent'}'s hand (watchedHands): they leave the hand face down, fan out below it and turn face up one after another, hold, then fold back into the hand.`,
      phase: 'game',
      game: animBase,
      gameId,
      gameUi: 'v1',
      action: { label: 'Replay', run: replayQuiet(animBase, gameId, (g) => withWatchedHand(g, opponentOfBase)) },
    })
    entries.push({
      id: 'anim:hand-revealed-v2',
      group: 'Animaciones',
      label: "Hand revealed: the opponent's hand fans out face up (new table)",
      description: "New table, where an opponent's hand is only a badge on the portrait: the three cards fan out of the hand badge face up, card by card, and fold back into it. The badge keeps pulsing: click it to open the hand.",
      phase: 'game',
      game: animBase,
      gameId,
      gameUi: 'v2',
      action: { label: 'Replay', run: replayQuiet(animBase, gameId, (g) => withWatchedHand(g, opponentOfBase)) },
    })
    const bushiBase = withFlipCard(untapPermanent(animBase, mystic), mystic, false)
    entries.push({
      id: 'anim:flip-card',
      group: 'Animaciones',
      label: 'Flip card: Bushi Tenderfoot flips into Kenzo the Hardhearted',
      description: 'A Kamigawa flip card. "Replay" flips Bushi Tenderfoot: the card lifts, turns a half circle on its face with a white flash and an arc of light, and settles upside down as Kenzo the Hardhearted.',
      phase: 'game',
      game: bushiBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(bushiBase, gameId, (g) => withFlipCard(g, mystic, true)) },
    })
    const slamBase = withMyPriority(withHeavySpellInHand(animBase))
    entries.push({
      id: 'anim:spell-slam',
      group: 'Animaciones',
      label: 'Spell weight: a 7-mana sorcery slams the board',
      description: 'Cruel Ultimatum (mana value 7) is in your hand. "Replay" casts it, a heavy flight to the stack, then resolves it: the board dims, a flash in its colours and a ring spread from the centre, the board quakes and the epic impact plays.',
      phase: 'game',
      game: slamBase,
      gameId,
      action: { label: 'Replay', run: replayQuietThen(slamBase, gameId, castHeavySpell, resolveHeavySpell, 60 + CAST_FLIGHT_MS + 700) },
    })
    entries.push({
      id: 'anim:ability-source',
      group: 'Animaciones',
      label: 'Ability on the stack: its source pulses',
      description: `"Replay" puts a triggered ability of ${mysticName} on the stack: the Mystic on the battlefield pulses while the ability flies to the stack.`,
      phase: 'game',
      game: animBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(animBase, gameId, (g) => triggerAbilityOf(g, mystic)) },
    })
    entries.push({
      id: 'anim:turn-banner',
      group: 'Animaciones',
      label: 'Turn banner: a new turn starts',
      description: `Turn ${animBase.turn}, your combat. "Replay" sends the first view of turn ${animBase.turn + 1}: the centred banner announces the turn number and ${opponentOfBase?.name ?? 'the opponent'}, the new active player.`,
      phase: 'game',
      game: animBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(animBase, gameId, (g) => startNextTurn(g, opponentOfBase)) },
    })
    const wipeBase = withStep(animBase, 'PRECOMBAT_MAIN', 'PRECOMBAT_MAIN')
    entries.push({
      id: 'anim:phase-wipe',
      group: 'Animaciones',
      label: 'Phase bar: the active step wipes in (classic table)',
      description: 'Classic table, main phase 1. Each press of "Next step" advances one step: the new active badge in the phase bar wipes in with a spring and the step name fades in beside it.',
      phase: 'game',
      game: wipeBase,
      gameId,
      gameUi: 'v1',
      action: { label: 'Next step', apply: advanceStep },
    })
    if (opponentOfBase) {
      const millDraw = (g: GameView): GameView => {
        const milled = Object.fromEntries([0, 1, 2].map((i) => {
          const id = `gallery-count-milled-${i}`
          return [id, { ...LIBRARY_CARDS[i % LIBRARY_CARDS.length], id, manaValue: 0 } as CardView]
        }))
        return {
          ...g,
          players: players(g).map((p) => (p.playerId === opponentOfBase.playerId
            ? { ...p, libraryCount: Math.max(0, (p.libraryCount ?? 0) - 5), handCount: (p.handCount ?? 0) + 2, graveyard: { ...p.graveyard, ...milled } }
            : p)),
        }
      }
      entries.push({
        id: 'anim:count-flash',
        group: 'Animaciones',
        label: 'Zone counts: +N / -N flash on the portrait',
        description: `"Replay" makes ${opponentOfBase.name} mill 3 and draw 2 in one update: their portrait flashes "-5" over the library, "+3" over the graveyard and "+2" over the hand, while the milled cards fly to the graveyard and two face-down cards to their hand.`,
        phase: 'game',
        game: animBase,
        gameId,
        action: { label: 'Replay', run: replayQuiet(animBase, gameId, millDraw) },
      })
    }
    const timerBase = withMyPriority(animBase)
    entries.push({
      id: 'anim:timer-low',
      group: 'Animaciones',
      label: 'Priority timer: tick, then shake when time runs low',
      description: 'You hold priority. "Replay" gives you 12 seconds on the clock: the timer badge counts down in amber, from 10 s each second pops with a tick (and the tick sound), and from 5 s it turns red and shakes until 00:00.',
      phase: 'game',
      game: timerBase,
      gameId,
      action: { label: 'Replay', run: replayQuiet(timerBase, gameId, (g) => withMyTimer(g, 12)) },
    })
    if (opponentOfBase && meOfBase) {
      const recapViews = opponentTurnRecapViews(animBase, mystic)
      const recapGame = recapViews[recapViews.length - 1] ?? animBase
      entries.push({
        id: 'anim:turn-recap',
        group: 'Animaciones',
        label: 'Turn recap: what happened on the opponent turn',
        description: `"Replay" feeds one ${opponentOfBase.name} turn through the real recap observer (they cast Grizzly Bears, attack, destroy ${mysticName} and you lose 1 life), then your turn starts: the recap strip slides down from the top with the summary and a chip for the destroyed card. It hides after 10 s.`,
        phase: 'game',
        game: recapGame,
        gameId,
        action: { label: 'Replay', run: replayTurnRecap(recapViews, gameId) },
      })
    }
    entries.push({
      id: 'anim:end-victory',
      group: 'Animaciones',
      label: 'End screen: victory cinematic',
      description: '"Replay" closes and reopens the match-won screen: gold rays fan out and spin, the title lands, gold particles rise, and the result panel rises in after 0.7 s.',
      screen: 'gameend',
      phase: 'game',
      game,
      gameId,
      gameEnd: GAME_END_MATCH,
      action: { label: 'Replay', run: replayGameEnd(GAME_END_MATCH) },
    })
    entries.push({
      id: 'anim:end-defeat',
      group: 'Animaciones',
      label: 'End screen: defeat cinematic',
      description: '"Replay" closes and reopens the game-lost screen: dark red rays fan out and spin, the title sinks in, grey ash particles fall, and the result panel rises in after 0.7 s.',
      screen: 'gameend',
      phase: 'game',
      game,
      gameId,
      gameEnd: GAME_END_GAME,
      action: { label: 'Replay', run: replayGameEnd(GAME_END_GAME) },
    })
  }

  if (THREE_PLAYER_COMMANDER && COMMANDER_FRAME) {
    const cmdMe = controlledPlayer(THREE_PLAYER_COMMANDER)
    const cmdRival = opponentPlayer(THREE_PLAYER_COMMANDER)
    if (cmdMe && cmdRival) {
      const cmdTurn = withStep(startNextTurn({ ...THREE_PLAYER_COMMANDER, turn: 5 }, cmdRival, 'PRECOMBAT_MAIN'), 'POSTCOMBAT_MAIN', 'POSTCOMBAT_MAIN')
      const cmdBase = withCommanderDamage(cmdTurn, cmdRival.playerId, cmdMe, 18)
      const cmdReplay = replayQuiet(cmdBase, COMMANDER_FRAME.gameId, (g) => withCommanderDamage(g, cmdRival.playerId, cmdMe, 21))
      entries.push({
        id: 'anim:commander-lethal',
        group: 'Animaciones',
        label: 'Commander damage: lethal cell pulses (classic table)',
        description: `Classic table, three-player Commander. ${cmdRival.name}'s commander has dealt you 18. "Replay" opens the Commander drawer and raises it to 21: the warning turns into a red lethal alert and the matrix cell pulses red, looping.`,
        phase: 'game',
        game: cmdBase,
        gameId: COMMANDER_FRAME.gameId,
        gameUi: 'v1',
        action: {
          label: 'Replay',
          run: () => {
            openDrawerTab('commander')
            cmdReplay()
          },
        },
      })
    }
  }

  if (COMMANDER_ZONE_FRAME) {
    const cmdGame = withMyPriority(calmGame(COMMANDER_ZONE_FRAME.gameView))
    const cmdGameId = COMMANDER_ZONE_FRAME.gameId
    const cmdMe = controlledPlayer(cmdGame)
    const cmdName = commanderOf(cmdMe)?.name ?? 'your commander'
    if (cmdMe && commanderOf(cmdMe)) {
      const onField = withCommanderIn(cmdGame, cmdMe.playerId, 'battlefield')
      const inGrave = withCommanderIn(cmdGame, cmdMe.playerId, 'graveyard')
      const back = () => ({ ...cmdGame })
      entries.push({
        id: 'anim:commander-to-command',
        group: 'Animaciones',
        label: 'Commander: back to the command zone from the battlefield (classic table)',
        description: `Commander duel (recorded frame), ${cmdName} is on your battlefield. "Replay" sends it to the command zone, as a bounce or exile replaced by the commander rule does: a column of gold light and a crown lift off where it stood, it flies in a gold-and-violet glow into its command-zone slot, and a gold ring spreads there as it lands.`,
        phase: 'game',
        game: onField,
        gameId: cmdGameId,
        gameUi: 'v1',
        action: { label: 'Replay', run: replayQuiet(onField, cmdGameId, back) },
      })
      entries.push({
        id: 'anim:commander-to-command-v2',
        group: 'Animaciones',
        label: 'Commander: back to the command zone from the battlefield (new table)',
        description: `The same return on the new table: ${cmdName} lifts off the battlefield in the crown's light and flies into the command-zone slot beside your creatures.`,
        phase: 'game',
        game: onField,
        gameId: cmdGameId,
        gameUi: 'v2',
        action: { label: 'Replay', run: replayQuiet(onField, cmdGameId, back) },
      })
      entries.push({
        id: 'anim:commander-grave-to-command',
        group: 'Animaciones',
        label: 'Commander: from the graveyard to the command zone',
        description: `${cmdName} died and is in your graveyard, where the server asks "Move ${cmdName} to the command zone?". "Replay" answers yes: the crown's light rises out of the graveyard pile and the commander flies from it into the command zone, instead of vanishing from the pile.`,
        phase: 'game',
        game: inGrave,
        gameId: cmdGameId,
        action: { label: 'Replay', run: replayQuiet(inGrave, cmdGameId, back) },
      })
      entries.push({
        id: 'anim:commander-cast',
        group: 'Animaciones',
        label: 'Commander: cast from the command zone',
        description: `${cmdName} is in your command zone. "Replay" casts it: the crown's light rises from the command zone and the commander lifts out of it, not out of your hand, holds in the middle of the screen and flies to the stack with the gold trail.`,
        phase: 'game',
        game: cmdGame,
        gameId: cmdGameId,
        action: { label: 'Replay', run: replayQuiet(cmdGame, cmdGameId, castMyCommander) },
      })
    }
  }
  if (THREE_PLAYER_COMMANDER && COMMANDER_FRAME) {
    const podCmd = withMyPriority(withStep(startNextTurn({ ...THREE_PLAYER_COMMANDER, turn: 5 }, controlledPlayer(THREE_PLAYER_COMMANDER), 'PRECOMBAT_MAIN'), 'PRECOMBAT_MAIN', 'PRECOMBAT_MAIN'))
    const podRival = opponentPlayer(podCmd)
    if (podRival && commanderOf(podRival)) {
      const rivalOnField = withCommanderIn(podCmd, podRival.playerId, 'battlefield')
      entries.push({
        id: 'anim:commander-to-command-pod',
        group: 'Animaciones',
        label: 'Commander: an opponent\'s commander goes back to the command zone (pod)',
        description: `Three-player Commander pod. ${podRival.name}'s commander is on their battlefield; "Replay" sends it back to their command zone: the gold column and crown rise from their seat and the card flies into the command zone of that seat.`,
        phase: 'game',
        game: rivalOnField,
        gameId: COMMANDER_FRAME.gameId,
        boardLayout: 'pod',
        action: { label: 'Replay', run: replayQuiet(rivalOnField, COMMANDER_FRAME.gameId, () => ({ ...podCmd })) },
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
    id: 'screen:rendered-cards',
    group: 'Pantallas',
    label: 'Rendered cards',
    description: 'Every distinct card layout in the recorded frames, drawn from data.',
    screen: 'cards',
    phase: 'game',
  })

  entries.push({
    id: 'screen:keyword-glyphs',
    group: 'Pantallas',
    label: 'Keyword glyphs',
    description: 'Every keyword of the glossary as the unified glyph coin, at card-badge size and at 14 px, with its id. An abbreviation means no pictogram fits.',
    screen: 'glyphs',
    phase: 'game',
  })

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
    myDeck: STAGING_DECK,
  })
  entries.push({
    id: 'screen:staging-pod',
    group: 'Pantallas',
    label: 'Sala de espera (pod Commander)',
    description: 'Mesa multijugador 3/4 con bot y plaza libre alrededor de la mesa.',
    phase: 'game',
    screen: 'staging',
    conn: GALLERY_CONN,
    lobby: LOBBY_OVERFLOW,
    stagingTable: STAGING_POD_TABLE,
    chatMessages: STAGING_CHAT,
    myDeck: STAGING_DECK,
  })
  entries.push({
    id: 'screen:staging-spectator',
    group: 'Pantallas',
    label: 'Sala de espera (espectador)',
    description: 'Espectando una mesa 1/2 que espera rival.',
    phase: 'game',
    screen: 'staging',
    stagingMode: 'spectator',
    conn: GALLERY_CONN,
    lobby: LOBBY_OVERFLOW,
    stagingTable: STAGING_OPEN_TABLE,
    chatMessages: [],
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
  if (FOUR_PLAYER_GAME) {
    const fourGameId = GANG_BLOCK_FRAME?.gameId ?? 'gallery-4p'
    const names = (FOUR_PLAYER_GAME.players ?? []).map((p) => ({ name: p.name, me: !!p.controlled }))
    const requester = names.find((n) => !n.me)?.name ?? 'Opponent'
    const turn = FOUR_PLAYER_GAME.turn ?? 3
    const baseVote = (over: Partial<RollbackVote>, statuses: RollbackVote['voters'][number]['status'][]): RollbackVote => ({
      gameId: fourGameId,
      requester,
      requesterUserId: 'gallery-requester',
      requestedByMe: false,
      turns: 0,
      requestedAtTurn: turn,
      voters: [
        { name: requester, status: 'requested', me: false },
        ...names.filter((n) => n.name !== requester).map((n, i) => ({ name: n.name, me: n.me, status: statuses[i] ?? 'pending' })),
      ],
      myVote: 'pending',
      outcome: 'voting',
      hidden: false,
      startedAt: Date.now(),
      ...over,
    })
    const meIdx = names.filter((n) => n.name !== requester).findIndex((n) => n.me)
    const withMe = (mine: RollbackVote['voters'][number]['status'], others: RollbackVote['voters'][number]['status'][]) => {
      const list = [...others]
      list.splice(meIdx < 0 ? 0 : meIdx, 0, mine)
      return list
    }
    const rollbackEntries: { id: string; label: string; description: string; vote: RollbackVote; game?: GameView }[] = [
      {
        id: 'dialog:rollback-vote',
        label: 'Rollback vote (my vote pending)',
        description: 'Blocking vote with every player and their status; Accept/Deny.',
        vote: baseVote({}, withMe('pending', ['accepted', 'pending'])),
      },
      {
        id: 'dialog:rollback-vote-waiting',
        label: 'Rollback vote (waiting, game moved on)',
        description: 'I accepted; one player still pending and the game advanced a turn (server counts from the last vote).',
        vote: baseVote({ myVote: 'accepted', requestedAtTurn: Math.max(1, turn - 1) }, withMe('accepted', ['accepted', 'pending'])),
      },
      {
        id: 'dialog:rollback-vote-denied',
        label: 'Rollback vote (denied)',
        description: 'Resolution: one player denied; Close dismisses.',
        vote: baseVote({ myVote: 'accepted', outcome: 'denied', deniedBy: names.filter((n) => n.name !== requester && !n.me)[1]?.name ?? '?' }, withMe('accepted', ['accepted', 'denied'])),
      },
      {
        id: 'dialog:rollback-vote-applied',
        label: 'Rollback vote (applied)',
        description: 'Resolution: all accepted and the server restored the turn.',
        vote: baseVote({ myVote: 'accepted', outcome: 'applied', appliedTurn: turn }, withMe('accepted', ['accepted', 'accepted'])),
      },
    ]
    for (const e of rollbackEntries) {
      entries.push({
        id: e.id,
        group: 'Dialogs',
        label: e.label,
        description: e.description,
        phase: 'game',
        game: FOUR_PLAYER_GAME,
        gameId: fourGameId,
        boardLayout: 'pod',
        rollbackVote: e.vote,
      })
    }
  }
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
  const focusOpp = FOUR_PLAYER_GAME ? opponentPlayer(FOUR_PLAYER_GAME) : undefined
  entries.push({
    id: 'board:arena-focus',
    group: 'Tablero',
    label: 'Arena (4 jugadores): un rival enfocado',
    description: 'Arena de 4 con un rival enfocado: su tablero ocupa la fila de rivales entera y los otros dos quedan como tira de estado (retrato, vida, mano y pilas). El botón "All boards" de su fila devuelve las columnas iguales.',
    phase: 'game',
    game: FOUR_PLAYER_GAME,
    gameId: GANG_BLOCK_FRAME?.gameId ?? null,
    boardLayout: 'arena',
    seatFocus: focusOpp?.playerId,
  })
  entries.push({
    id: 'board:priority-frame',
    group: 'Tablero',
    label: 'Prioridad: marco del asiento',
    description: 'Arena de 4 con la prioridad en un rival que no es el jugador activo: todo su asiento brilla con un marco dorado. Pulsa "Pasar prioridad" para rotarla por la mesa.',
    phase: 'game',
    game: FOUR_PLAYER_GAME ? withPriorityOnRival(FOUR_PLAYER_GAME) : null,
    gameId: GANG_BLOCK_FRAME?.gameId ?? null,
    boardLayout: 'arena',
    action: { label: 'Pasar prioridad', apply: rotatePriority },
  })
  entries.push({
    id: 'board:pod-4-crowded',
    group: 'Tablero',
    label: 'Pod 2×2 con el campo lleno',
    description: '4 jugadores con 16 criaturas y 14 tierras cada uno: las bandas encogen las cartas (y se reparten en líneas) en vez de hacer scroll.',
    phase: 'game',
    game: CROWDED_POD_GAME,
    gameId: GANG_BLOCK_FRAME?.gameId ?? null,
    boardLayout: 'pod',
  })
  entries.push({
    id: 'board:arena-4-crowded',
    group: 'Tablero',
    label: 'Arena con el campo lleno',
    description: 'Mismo campo lleno con layout arena (rivales en columnas compactas).',
    phase: 'game',
    game: CROWDED_POD_GAME,
    gameId: GANG_BLOCK_FRAME?.gameId ?? null,
    boardLayout: 'arena',
  })
  entries.push({
    id: 'board:arena-kind-columns',
    group: 'Tablero',
    label: 'Arena: lands left, rocks and Treasures right, planeswalkers in a column',
    description: 'Four-seat Commander with lands, mana rocks, Treasures, a planeswalker and a saga on several seats. Lands sit left of the other permanents on every board; planeswalkers and sagas form a column at the right edge spanning the creature and permanent rows.',
    phase: 'game',
    game: KIND_COLUMNS_GAME,
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
    id: 'game:hand-3',
    group: 'Tablero',
    label: 'Mano de 3 cartas',
    description: 'Mano corta (3 cartas) sobre el frame gang-block.',
    phase: 'game',
    game: HAND_3_GAME,
    gameId: GANG_BLOCK_FRAME?.gameId ?? null,
  })
  entries.push({
    id: 'game:hand-8',
    group: 'Tablero',
    label: 'Mano de 8 cartas',
    description: 'Mano media (8 cartas) sobre el frame gang-block.',
    phase: 'game',
    game: HAND_8_GAME,
    gameId: GANG_BLOCK_FRAME?.gameId ?? null,
  })
  entries.push({
    id: 'game:hand-12',
    group: 'Tablero',
    label: 'Mano de 12 cartas',
    description: 'Mano larga (12 cartas) sobre el frame gang-block.',
    phase: 'game',
    game: HAND_12_GAME,
    gameId: GANG_BLOCK_FRAME?.gameId ?? null,
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
    id: 'game:top-card-peek',
    group: 'Tablero',
    label: 'Top card peek',
    description: '"Look at the top card of your library any time" (Future Sight…): the card sits small left of the library, no blocking viewer.',
    phase: 'game',
    game: TOP_CARD_PEEK_GAME,
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
