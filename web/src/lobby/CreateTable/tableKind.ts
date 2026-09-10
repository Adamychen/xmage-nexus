import {
  DEFAULT_TOURNAMENT_TYPES,
  MAX_DRAFT_PLAYERS,
  MAX_TOURNAMENT_PLAYERS,
  HUMAN_SEAT,
  SIM_SEAT,
  isConstructedTournamentType,
  isDraftTournamentType,
  isHumanSeatType,
  normalizeSeatType,
  normalizeTournamentType,
  parseLimitedSetCodes,
  buildLimitedOptions,
  type DraftTiming,
} from './constants'
import { isLimitedDeckType } from '../../decks/formatRules'

export type TableKind = 'match' | 'constructed-tourney' | 'draft-tourney' | 'invalid'

// Matriz de decisión del wizard (una sola fuente de verdad).
// Los 55 useState del formulario colapsan en estas clases; `resolveTableKind`
// es la única que decide la ruta del submit. Invariante que el hook mantiene:
//   tableCategory === 'tourney'  ⇒  useDraftTournament === (tournamentCategory === 'limited')
// En modo torneo manda la pestaña (categoría); en duelo/multi manda el flag
// useDraftTournament. `healTournamentBranch` restaura el invariante al cargar
// estado persistido. Clases `invalid` nunca llegan al servidor: el submit
// aborta con `create_err_bad_tournament_type` (el servidor responde NPE).

export type TableCategoryInput = 'duel' | 'multi' | 'tourney'
export type TournamentCategoryInput = 'limited' | 'constructed'

export interface TableKindInputs {
  tableCategory: TableCategoryInput
  tournamentCategory: TournamentCategoryInput
  useDraftTournament: boolean
  deckType: string
  tournamentType: string
  knownTournamentTypes: string[]
}

export interface TableKindResolution {
  kind: TableKind
  isDraftLimited: boolean
  isConstructedTournament: boolean
  isTournament: boolean
  normalizedTournamentType: string
  errorKey: 'create_err_bad_tournament_type' | null
  errorParam: string
}

export function resolveTableKind(inputs: TableKindInputs): TableKindResolution {
  const known = inputs.knownTournamentTypes.length > 0 ? inputs.knownTournamentTypes : DEFAULT_TOURNAMENT_TYPES
  const normalizedTournamentType = normalizeTournamentType(inputs.tournamentType, known)
  const isDraftLimited =
    (inputs.tableCategory === 'tourney' && inputs.tournamentCategory === 'limited') ||
    (isLimitedDeckType(inputs.deckType) && inputs.useDraftTournament)
  const isConstructedTournament =
    (inputs.tableCategory === 'tourney' && inputs.tournamentCategory === 'constructed') ||
    (isConstructedTournamentType(normalizedTournamentType) &&
      !inputs.useDraftTournament &&
      !isLimitedDeckType(inputs.deckType))
  const isTournament =
    inputs.tableCategory === 'tourney' || isDraftLimited || isConstructedTournament
  const base = { isDraftLimited, isConstructedTournament, isTournament, normalizedTournamentType }
  if (isTournament && !known.includes(normalizedTournamentType)) {
    return { ...base, kind: 'invalid', errorKey: 'create_err_bad_tournament_type', errorParam: inputs.tournamentType }
  }
  if (isDraftLimited && isConstructedTournamentType(normalizedTournamentType)) {
    return { ...base, kind: 'invalid', errorKey: 'create_err_bad_tournament_type', errorParam: normalizedTournamentType }
  }
  if (!isTournament) {
    return { ...base, kind: 'match', errorKey: null, errorParam: '' }
  }
  return {
    ...base,
    kind: isDraftLimited ? 'draft-tourney' : 'constructed-tourney',
    errorKey: null,
    errorParam: '',
  }
}

export function clampNumPlayers(
  numPlayers: number,
  opts: { draft: boolean; tourney: boolean },
  gameTypeMin: number,
  gameTypeMax: number,
): number {
  const min = gameTypeMin
  const max = opts.draft ? MAX_DRAFT_PLAYERS : opts.tourney ? MAX_TOURNAMENT_PLAYERS : gameTypeMax
  if (numPlayers < min) return min
  if (numPlayers > max) return max
  return numPlayers
}

export function defaultSeatTypeFor(draft: boolean): string {
  return draft ? 'COMPUTER_DRAFT_BOT' : SIM_SEAT
}

export interface SeatConfigInput {
  type: string
  deckName: string
  skill: number
}

export function computeTournamentSeats(args: {
  seatConfigs: SeatConfigInput[]
  playerTypesSel: string[]
  numPlayers: number
  humanSeat: boolean
  draft: boolean
}): { playerTypesFinal: string[]; effectiveSeatTypes: string[] } {
  const seatTypes = args.seatConfigs.map((s) => normalizeSeatType(s.type))
  const fallbackTypes = (args.playerTypesSel.length ? args.playerTypesSel : [HUMAN_SEAT]).map(normalizeSeatType)
  const effectiveSeatTypes =
    seatTypes.length > 0
      ? seatTypes
      : fallbackTypes.slice(0, Math.max(0, args.numPlayers - (args.humanSeat ? 1 : 0)))
  const playerTypesFinal = args.humanSeat ? [HUMAN_SEAT, ...effectiveSeatTypes] : effectiveSeatTypes
  while (playerTypesFinal.length < args.numPlayers) {
    playerTypesFinal.push(args.draft ? HUMAN_SEAT : SIM_SEAT)
  }
  while (playerTypesFinal.length > args.numPlayers) playerTypesFinal.pop()
  return { playerTypesFinal, effectiveSeatTypes }
}

export function computeMatchSeats(args: {
  seatConfigs: SeatConfigInput[]
  playerTypesSel: string[]
  numPlayers: number
  humanSeat: boolean
}): { playerTypesFinal: string[]; effectiveSeatTypes: string[] } {
  const seatTypes = args.seatConfigs.map((s) => normalizeSeatType(s.type))
  const fallbackTypes = (args.playerTypesSel.length ? args.playerTypesSel : [SIM_SEAT]).map(normalizeSeatType)
  const effectiveSeatTypes =
    seatTypes.length > 0
      ? seatTypes
      : fallbackTypes.slice(0, Math.max(0, args.numPlayers - (args.humanSeat ? 1 : 0)))
  const playerTypesFinal = args.humanSeat ? [HUMAN_SEAT, ...effectiveSeatTypes] : effectiveSeatTypes
  while (playerTypesFinal.length < args.numPlayers) playerTypesFinal.push(SIM_SEAT)
  while (playerTypesFinal.length > args.numPlayers) playerTypesFinal.pop()
  return { playerTypesFinal, effectiveSeatTypes }
}

export interface DraftOptionsInput {
  draftSetsRaw: string
  draftBoosters: number
  draftConstructionTime: number
  draftCubeName: string
  draftTiming: DraftTiming
  tournamentType: string
}

export function expandDraftSetCodes(raw: string, boosters: number): string[] {
  const parsed = parseLimitedSetCodes(raw)
  if (parsed.length === 1 && boosters > 1) {
    return Array.from({ length: boosters }, () => parsed[0])
  }
  return parsed
}

export type DraftSetsError = 'draft_no_sets' | 'draft_sets_count_mismatch' | null

export function uniformDraftSet(raw: string): string | null {
  const parsed = parseLimitedSetCodes(raw)
  if (parsed.length === 0) return null
  return parsed.every((c) => c === parsed[0]) ? parsed[0] : null
}

export function validateDraftSets(
  raw: string,
  boosters: number,
  opts?: { cube?: boolean; random?: boolean },
): DraftSetsError {
  const parsed = parseLimitedSetCodes(raw)
  if (parsed.length === 0) return 'draft_no_sets'
  if (!opts?.cube && !opts?.random && parsed.length > 1 && parsed.length < boosters) {
    return 'draft_sets_count_mismatch'
  }
  return null
}

export function buildTournamentLimitedOptions(
  opts: DraftOptionsInput,
): ReturnType<typeof buildLimitedOptions> {
  return buildLimitedOptions({
    numberBoosters: opts.draftBoosters,
    constructionTime: opts.draftConstructionTime,
    setCodes: expandDraftSetCodes(opts.draftSetsRaw, opts.draftBoosters),
    ...(opts.draftCubeName ? { draftCubeName: opts.draftCubeName } : {}),
    ...(isDraftTournamentType(opts.tournamentType) ? { timing: opts.draftTiming } : {}),
  })
}

export interface TournamentArgsInput {
  name: string
  username: string
  tournamentType: string
  gameType: string
  deckType: string
  draft: boolean
  limitedOptions?: ReturnType<typeof buildLimitedOptions>
  playerTypesFinal: string[]
  password: string
  spectatorsAllowed: boolean
  wins: number
  numberRounds: number
  skillLevel: 'BEGINNER' | 'CASUAL' | 'SERIOUS'
  rated: boolean
  rollbackTurnsAllowed: boolean
  timeLimit: string
  bufferTime: string
  minimumRating: number
  quitRatio: number
  bannedUsersRaw: string
  singleGame: boolean
}

export function buildCreateTournamentArgs(a: TournamentArgsInput): Record<string, unknown> {
  const bannedUsers = a.bannedUsersRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return {
    name: a.name || `${a.username}'s table`,
    tournamentType: a.tournamentType,
    gameType: a.gameType,
    deckType: a.draft ? 'Limited' : a.deckType,
    limited: a.draft,
    ...(a.limitedOptions ? { limitedOptions: a.limitedOptions } : {}),
    playerTypes: a.playerTypesFinal.length > 0 ? a.playerTypesFinal : ['HUMAN'],
    password: a.password.trim() || undefined,
    watchingAllowed: a.spectatorsAllowed,
    spectatorsAllowed: a.spectatorsAllowed,
    winsNeeded: a.wins,
    ...(a.numberRounds > 0 ? { numberRounds: a.numberRounds } : {}),
    skillLevel: a.skillLevel,
    rated: a.rated,
    rollbackTurnsAllowed: a.rollbackTurnsAllowed,
    timeLimit: a.timeLimit === 'NONE' ? undefined : a.timeLimit,
    bufferTime: a.bufferTime === 'NONE' ? undefined : a.bufferTime,
    minimumRating: a.minimumRating > 0 ? a.minimumRating : undefined,
    quitRatio: a.quitRatio,
    bannedUsers: bannedUsers.length > 0 ? bannedUsers : undefined,
    isSingleMultiplayerGame: a.singleGame || undefined,
  }
}

export interface MatchArgsInput {
  name: string
  username: string
  gameType: string
  deckType: string
  wins: number
  playerTypesFinal: string[]
  seatSkills: number[]
  password: string
  skillLevel: 'BEGINNER' | 'CASUAL' | 'SERIOUS'
  rated: boolean
  spectatorsAllowed: boolean
  rollbackTurnsAllowed: boolean
  timeLimit: string
  bufferTime: string
  freeMulligans: number
  showRangeAttack: boolean
  attackOption: string
  range: string
  minimumRating: number
  quitRatio: number
  edhPowerLevel: number
  bannedUsersRaw: string
  mulliganType: string
  customStartLifeEnabled: boolean
  customStartLife: number
  customStartHandSizeEnabled: boolean
  customStartHandSize: number
  planeChase: boolean
  simDecks?: unknown[]
  skipInitShuffling?: boolean
  skipStartingPlayerChoice?: boolean
  dev: boolean
}

export function buildCreateMatchArgs(a: MatchArgsInput): Record<string, unknown> {
  const bannedUsers = a.bannedUsersRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return {
    name: a.name || `${a.username}'s table`,
    gameType: a.gameType,
    deckType: a.deckType,
    winsNeeded: a.wins,
    playerTypes: a.playerTypesFinal,
    password: a.password.trim() || undefined,
    skillLevel: a.skillLevel,
    rated: a.rated,
    spectatorsAllowed: a.spectatorsAllowed,
    rollbackTurnsAllowed: a.rollbackTurnsAllowed,
    timeLimit: a.timeLimit === 'NONE' ? undefined : a.timeLimit,
    bufferTime: a.bufferTime === 'NONE' ? undefined : a.bufferTime,
    freeMulligans: a.freeMulligans,
    attackOption: a.showRangeAttack ? a.attackOption : undefined,
    range: a.showRangeAttack ? a.range : undefined,
    minimumRating: a.minimumRating > 0 ? a.minimumRating : undefined,
    quitRatio: a.quitRatio,
    edhPowerLevel: a.edhPowerLevel < 100 ? a.edhPowerLevel : undefined,
    bannedUsers: bannedUsers.length > 0 ? bannedUsers : undefined,
    seatSkills: a.seatSkills,
    ...(a.dev ? { skipInitShuffling: a.skipInitShuffling, skipStartingPlayerChoice: a.skipStartingPlayerChoice } : {}),
    limited: isLimitedDeckType(a.deckType) || undefined,
    mulliganType: a.mulliganType !== 'GAME_DEFAULT' ? a.mulliganType : undefined,
    customStartLifeEnabled: a.customStartLifeEnabled || undefined,
    customStartLife: a.customStartLifeEnabled ? a.customStartLife : undefined,
    customStartHandSizeEnabled: a.customStartHandSizeEnabled || undefined,
    customStartHandSize: a.customStartHandSizeEnabled ? a.customStartHandSize : undefined,
    planeChase: a.planeChase || undefined,
    simDecks: (a.simDecks?.length ?? 0) > 0 ? a.simDecks : undefined,
  }
}

export function tournamentJoinNeedsDeck(gameType: string | undefined): boolean {
  return isConstructedTournamentType(gameType ?? '')
}

/** Los bots nunca entregan el mazo construido: un limitado con IA no llega a rondas. */
export function limitedTourneyHasAiSeats(playerTypesFinal: string[]): boolean {
  return playerTypesFinal.some((t) => !isHumanSeatType(t))
}

export function healTournamentBranch(args: {
  tableCategory: TableCategoryInput
  tournamentCategory: TournamentCategoryInput
  useDraftTournament: boolean
}): { tournamentCategory: TournamentCategoryInput; useDraftTournament: boolean } {
  if (args.tableCategory !== 'tourney') {
    return { tournamentCategory: args.tournamentCategory, useDraftTournament: args.useDraftTournament }
  }
  return {
    tournamentCategory: args.tournamentCategory,
    useDraftTournament: args.tournamentCategory === 'limited',
  }
}
