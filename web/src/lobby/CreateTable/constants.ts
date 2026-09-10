import type { GameTypeInfo } from '../../net/commands'

export const STORAGE_KEY = 'mage_createTable_v1'

export type CreateTab = 'general' | 'timing' | 'security' | 'seats' | 'dev'

export const TIME_LIMIT_OPTIONS = [
  { label: 'Sin límite (None)', value: 'NONE' },
  { label: '15 Minutos', value: 'MIN__15' },
  { label: '20 Minutos', value: 'MIN__20' },
  { label: '25 Minutos (Estándar)', value: 'MIN__25' },
  { label: '30 Minutos', value: 'MIN__30' },
  { label: '45 Minutos', value: 'MIN__45' },
  { label: '60 Minutos (Largo)', value: 'MIN__60' },
  { label: '90 Minutos', value: 'MIN__90' },
]

export const BUFFER_TIME_OPTIONS = [
  { label: 'Sin buffer adicional', value: 'NONE' },
  { label: '5 Segundos', value: 'SEC__05' },
  { label: '10 Segundos', value: 'SEC__10' },
  { label: '15 Segundos', value: 'SEC__15' },
  { label: '20 Segundos', value: 'SEC__20' },
  { label: '30 Segundos', value: 'SEC__30' },
]

export function getTimeLimitLabel(opt: { value: string; label: string }, t?: (cat: any, key: any, params?: any) => string): string {
  if (!t) return opt.label
  if (opt.value === 'NONE') return t('lobby', 'create_time_none')
  const min = opt.value.replace('MIN__', '')
  if (opt.value === 'MIN__25') return t('lobby', 'create_time_standard', { min })
  if (opt.value === 'MIN__60') return t('lobby', 'create_time_long', { min })
  return t('lobby', 'create_time_minutes', { min })
}

export function getBufferTimeLabel(opt: { value: string; label: string }, t?: (cat: any, key: any, params?: any) => string): string {
  if (!t) return opt.label
  if (opt.value === 'NONE') return t('lobby', 'create_buffer_none')
  const sec = opt.value.replace('SEC__', '')
  return t('lobby', 'create_buffer_seconds', { sec })
}

export const DEFAULT_GAME_TYPES: GameTypeInfo[] = [
  { name: 'Two Player Duel', minPlayers: 2, maxPlayers: 2 },
  { name: 'Free For All', minPlayers: 3, maxPlayers: 10 },
  { name: 'Commander Two Player Duel', minPlayers: 2, maxPlayers: 2 },
  { name: 'Commander Free For All', minPlayers: 3, maxPlayers: 10 },
  { name: 'Tiny Leaders Two Player Duel', minPlayers: 2, maxPlayers: 2 },
  { name: 'Canadian Highlander Two Player Duel', minPlayers: 2, maxPlayers: 2 },
  { name: 'Penny Dreadful Commander Free For All', minPlayers: 3, maxPlayers: 10 },
  { name: 'Freeform Commander Two Player Duel', minPlayers: 2, maxPlayers: 2 },
  { name: 'Freeform Commander Free For All', minPlayers: 3, maxPlayers: 10 },
  { name: 'Freeform Unlimited Commander', minPlayers: 2, maxPlayers: 10 },
  { name: 'Oathbreaker Two Player Duel', minPlayers: 2, maxPlayers: 2 },
  { name: 'Oathbreaker Free For All', minPlayers: 3, maxPlayers: 10 },
  { name: 'Brawl Two Player Duel', minPlayers: 2, maxPlayers: 2 },
  { name: 'Brawl Free For All', minPlayers: 3, maxPlayers: 10 },
  { name: 'Momir Basic Two Player Duel', minPlayers: 2, maxPlayers: 2 },
  { name: 'Momir Basic Free For All', minPlayers: 3, maxPlayers: 10 },
  { name: 'Custom Pillar of the Paruns Two Player Duel', minPlayers: 2, maxPlayers: 2 },
]

export const DEFAULT_DECK_TYPES: string[] = [
  'Constructed - Standard',
  'Constructed - Extended',
  'Constructed - Frontier',
  'Constructed - Pioneer',
  'Constructed - Modern',
  'Constructed - Modern - No Banned List',
  'Constructed - Eternal',
  'Constructed - Legacy',
  'Constructed - Vintage',
  'Constructed - Pauper',
  'Constructed - Historic',
  'Constructed - Historical Type 2',
  'Constructed - Super Type 2',
  'Constructed - Australian Highlander',
  'Constructed - Canadian Highlander',
  'Constructed - European Highlander',
  'Constructed - Old School 93/94',
  'Constructed - Old School 93/94 - Italian Rules',
  'Constructed - Old School 93/94 - Channel Fireball Rules',
  'Constructed - Old School 93/94 - EudoGames Rules',
  'Constructed - Old School 93/94 - EC Rules',
  'Constructed - Premodern',
  'Constructed - Freeform',
  'Constructed - Freeform Unlimited',
  'Variant Magic - Commander',
  'Variant Magic - Duel Commander',
  'Variant Magic - MTGO 1v1 Commander',
  'Variant Magic - Centurion Commander',
  'Variant Magic - Tiny Leaders',
  'Variant Magic - Momir Basic',
  'Variant Magic - Penny Dreadful Commander',
  'Variant Magic - Freeform Commander',
  'Variant Magic - Freeform Unlimited Commander',
  'Variant Magic - Brawl',
  'Variant Magic - Oathbreaker',
  'Block Constructed - Amonkhet',
  'Block Constructed - Battle for Zendikar',
  'Block Constructed - Innistrad',
  'Block Constructed - Ixalan',
  'Block Constructed - Kaladesh',
  'Block Constructed - Kamigawa',
  'Block Constructed - Khans of Tarkir',
  'Block Constructed - Lorwyn',
  'Block Constructed - Return to Ravnica',
  'Block Constructed - Scars of Mirrodin',
  'Block Constructed - Shadowmoor',
  'Block Constructed - Shadows over Innistrad',
  'Block Constructed - Shards of Alara',
  'Block Constructed - Theros',
  'Block Constructed - Zendikar',
  'Block Constructed Custom - Star Wars',
  'Limited',
]

export const DEFAULT_PLAYER_TYPES: string[] = [
  'SIM',
  'COMPUTER_MAD',
  'COMPUTER_MONTE_CARLO',
  'COMPUTER_DRAFT_BOT',
]

export const HUMAN_SEAT = 'HUMAN'
export const SIM_SEAT = 'SIM'

const SEAT_TYPE_ALIASES: Record<string, string> = {
  HUMAN: HUMAN_SEAT,
  SIM: SIM_SEAT,
  SIMULATED: SIM_SEAT,
  COMPUTER_MAD: 'COMPUTER_MAD',
  COMPUTER_MAD_AI: 'COMPUTER_MAD',
  COMPUTER_MONTE_CARLO: 'COMPUTER_MONTE_CARLO',
  COMPUTER_MONTECARLO: 'COMPUTER_MONTE_CARLO',
  COMPUTER_MCTS: 'COMPUTER_MONTE_CARLO',
  COMPUTER_DRAFT: 'COMPUTER_DRAFT_BOT',
  COMPUTER_DRAFT_BOT: 'COMPUTER_DRAFT_BOT',
  COMPUTER_DRAFTBOT: 'COMPUTER_DRAFT_BOT',
}

function seatTypeKey(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

export function normalizeSeatType(raw: string): string {
  const key = seatTypeKey(raw)
  return SEAT_TYPE_ALIASES[key] ?? raw
}

export function isHumanSeatType(t: string): boolean {
  return seatTypeKey(t) === HUMAN_SEAT
}

export function isSimSeatType(t: string): boolean {
  return seatTypeKey(t) === SIM_SEAT
}

export function isNativeAiSeatType(t: string): boolean {
  const k = seatTypeKey(t)
  return k !== HUMAN_SEAT && k !== SIM_SEAT
}

export function aiSeatTypes(playerTypes: string[]): string[] {
  const out: string[] = []
  for (const pt of playerTypes) {
    const n = normalizeSeatType(pt)
    if (isHumanSeatType(n) || isSimSeatType(n)) continue
    if (!out.includes(n)) out.push(n)
  }
  return out
}

const SEAT_TYPE_LABELS: Record<string, string> = {
  [HUMAN_SEAT]: 'Humano — espera rival',
  [SIM_SEAT]: 'SIM',
  COMPUTER_MAD: 'IA Mad',
  COMPUTER_MONTE_CARLO: 'IA Montecarlo',
  COMPUTER_DRAFT_BOT: 'IA Draftbot',
}

export function seatTypeLabel(tName: string, t?: (cat: any, key: any) => string): string {
  const n = normalizeSeatType(tName)
  if (t && n === HUMAN_SEAT) return t('lobby', 'create_seat_human_waiting_label')
  return SEAT_TYPE_LABELS[n] ?? tName
}

export const SKILL_LEVEL_OPTIONS: Array<{ label: string; value: string; stars: number }> = [
  { label: 'Novato', value: 'BEGINNER', stars: 1 },
  { label: 'Casual', value: 'CASUAL', stars: 2 },
  { label: 'Competitivo', value: 'SERIOUS', stars: 3 },
]

export const DEFAULT_TOURNAMENT_TYPES: string[] = [
  'Constructed Elimination',
  'Constructed Swiss',
  'Booster Draft Elimination',
  'Booster Draft Elimination (Cube)',
  'Booster Draft Elimination (Random)',
  'Booster Draft Elimination (Reshuffled)',
  'Booster Draft Elimination (Rich Man)',
  'Booster Draft Elimination (Rich Man Cube)',
  'Booster Draft Swiss',
  'Booster Draft Swiss (Cube)',
  'Booster Draft Swiss (Random)',
  'Booster Draft Swiss (Reshuffled)',
  'Booster Draft Swiss (Rich Man)',
  'Booster Draft Swiss (Rich Man Cube)',
  'Sealed Elimination',
  'Sealed Elimination (Cube)',
  'Sealed Swiss',
  'Sealed Swiss (Cube)',
  'Jumpstart Elimination',
  'Jumpstart Swiss',
  'Jumpstart Elimination (Custom)',
]

export type TableCategory = 'duel' | 'multi' | 'tourney'
export type TournamentCategory = 'limited' | 'constructed'

export const CONSTRUCTED_TOURNAMENT_TYPES = [
  'Constructed Swiss',
  'Constructed Elimination',
]

export const DEFAULT_DRAFT_TOURNAMENT_TYPE = 'Booster Draft Elimination'

export function tournamentTypeNameOf(t: unknown): string {
  if (typeof t === 'string') return t
  if (t && typeof t === 'object' && 'name' in t && typeof (t as { name: unknown }).name === 'string') {
    return (t as { name: string }).name
  }
  return ''
}

export function normalizeTournamentType(raw: string, known: string[]): string {
  if (!raw) return known.includes(DEFAULT_DRAFT_TOURNAMENT_TYPE) ? DEFAULT_DRAFT_TOURNAMENT_TYPE : (known[0] ?? DEFAULT_DRAFT_TOURNAMENT_TYPE)
  if (known.includes(raw)) return raw
  if (raw === 'Booster Draft') {
    return known.find((n) => n === DEFAULT_DRAFT_TOURNAMENT_TYPE)
      ?? known.find((n) => n.startsWith('Booster Draft'))
      ?? known.find((n) => isDraftTournamentType(n))
      ?? raw
  }
  return raw
}

export function defaultTournamentType(known: string[]): string {
  return known.includes(DEFAULT_DRAFT_TOURNAMENT_TYPE)
    ? DEFAULT_DRAFT_TOURNAMENT_TYPE
    : (known.find((n) => isDraftTournamentType(n)) ?? known[0] ?? DEFAULT_DRAFT_TOURNAMENT_TYPE)
}

export const LIMITED_TOURNAMENT_TYPES = DEFAULT_TOURNAMENT_TYPES.filter(
  (t) => typeof t === 'string' && !t.startsWith('Constructed'),
)

export function isConstructedTournamentType(t: unknown): boolean {
  if (typeof t === 'string') return t.startsWith('Constructed')
  if (t && typeof t === 'object' && 'name' in t && typeof (t as { name: unknown }).name === 'string') {
    return ((t as { name: string }).name).startsWith('Constructed')
  }
  return false
}

export const POPULAR_CONSTRUCTED_DECK_TYPES = [
  'Constructed - Modern',
  'Constructed - Standard',
  'Constructed - Pioneer',
  'Constructed - Pauper',
  'Constructed - Legacy',
  'Constructed - Vintage',
  'Variant Magic - Commander',
  'Variant Magic - Brawl',
]

export const DEFAULT_DRAFT_CUBES: string[] = [
  'Cube From Deck',
  'MTGO Legacy Cube',
  'MTGO Vintage Cube',
  'MTGO Legendary Cube',
  'MTGO Legendary Cube April 2016',
  'MTGO Modern Cube 2017',
  'MTGO Khans Expanded Cube',
  'MTGO Cube March 2014',
  'MTGA Cube 2020 April',
  'SCG Con Cube 2018 December',
  "The Peasant's Toolbox",
  'www.MTGCube.com',
  'The Pauper Cube',
  "Ben's Cube",
  'Cube Tutor 360 Pauper',
  'Cube Tutor 720',
  "Eric Klug's Pro Tour Cube",
  "Guillaume Matignon's Jenny's/Johnny's Cube",
  "Jim Davis's Cube",
  "Joseph Vasoli's Peasant Cube",
  "Sam Black's No Search Cube",
  "Timothee Simonot's Twisted Color Pie Cube",
  'Mono Blue Cube',
  'MTGO Legacy Cube 2016 January',
  'MTGO Legacy Cube 2016 September',
  'MTGO Legacy Cube 2017 January',
  'MTGO Legacy Cube 2017 April',
  'MTGO Legacy Cube 2018 February',
  'MTGO Legacy Cube 2019 July',
  'MTGO Legacy Cube 2021 May',
  'MTGO Vintage Cube 2015',
  'MTGO Vintage Cube 2016',
  'MTGO Vintage Cube June 2016',
  'MTGO Vintage Cube November 2016',
  'MTGO Vintage Cube June 2017',
  'MTGO Vintage Cube December 2017',
  'MTGO Vintage Cube June 2018',
  'MTGO Vintage Cube December 2018',
  'MTGO Vintage Cube June 2019',
  'MTGO Vintage Cube December 2019',
  'MTGO Vintage Cube April 2020',
  'MTGO Vintage Cube July 2020',
  'MTGO Vintage Cube December 2020',
  'MTGO Vintage Cube July 2021',
  'MTGO Vintage Cube February 2022',
  'MTGO Vintage Cube October 2023',
]

export type DraftTiming = 'BEGINNER' | 'REGULAR' | 'PROFESSIONAL'

export interface BoosterSetItem {
  code: string
  name: string
}

export const DEFAULT_BOOSTER_SETS: BoosterSetItem[] = [
  { code: 'FDN', name: 'Foundations' },
  { code: 'DSK', name: 'Duskmourn: House of Horror' },
  { code: 'BLB', name: 'Bloomburrow' },
  { code: 'MH3', name: 'Modern Horizons 3' },
  { code: 'OTJ', name: 'Outlaws of Thunder Junction' },
  { code: 'MKM', name: 'Murders at Karlov Manor' },
  { code: 'LCI', name: 'The Lost Caverns of Ixalan' },
  { code: 'WOE', name: 'Wilds of Eldraine' },
  { code: 'MOM', name: 'March of the Machine' },
  { code: 'ONE', name: 'Phyrexia: All Will Be One' },
  { code: 'BRO', name: "The Brothers' War" },
  { code: 'DMU', name: 'Dominaria United' },
  { code: '2X2', name: 'Double Masters 2022' },
  { code: 'SNC', name: 'Streets of New Capenna' },
  { code: 'NEO', name: 'Kamigawa: Neon Dynasty' },
  { code: 'VOW', name: 'Innistrad: Crimson Vow' },
  { code: 'MID', name: 'Innistrad: Midnight Hunt' },
  { code: 'MH2', name: 'Modern Horizons 2' },
  { code: 'STX', name: 'Strixhaven: School of Mages' },
  { code: 'KHM', name: 'Kaldheim' },
  { code: 'ZNR', name: 'Zendikar Rising' },
  { code: '2XM', name: 'Double Masters' },
  { code: 'M21', name: 'Core Set 2021' },
  { code: 'IKO', name: 'Ikoria: Lair of Behemoths' },
  { code: 'THB', name: 'Theros Beyond Death' },
  { code: 'ELD', name: 'Throne of Eldraine' },
  { code: 'WAR', name: 'War of the Spark' },
  { code: 'RNA', name: 'Ravnica Allegiance' },
  { code: 'GRN', name: 'Guilds of Ravnica' },
  { code: 'DOM', name: 'Dominaria' },
]

export const DRAFT_TIMING_OPTIONS: { value: DraftTiming; label: string }[] = [
  { value: 'BEGINNER', label: 'Beginner (x2.0)' },
  { value: 'REGULAR', label: 'Regular (x1.5)' },
  { value: 'PROFESSIONAL', label: 'Professional (x1.0)' },
]

export interface LimitedDraftOptions {
  numberBoosters: number
  constructionTime: number
  setCodes: string[]
  draftCubeName?: string
  timing?: DraftTiming
}

export const LIMITED_BOOSTER_OPTIONS = [3, 6] as const
export const CONSTRUCTION_TIME_OPTIONS = [
  { label: '5 minutos', value: 300 },
  { label: '10 minutos', value: 600 },
  { label: '15 minutos', value: 900 },
  { label: '25 minutos', value: 1500 },
] as const

export function getConstructionTimeLabel(opt: { value: number; label: string }, t?: (cat: any, key: any, params?: any) => string): string {
  if (!t) return opt.label
  const min = String(Math.round(opt.value / 60))
  return t('lobby', 'create_construction_minutes', { min })
}

export function buildLimitedOptions(opts: LimitedDraftOptions): Record<string, unknown> {
  return {
    numberBoosters: opts.numberBoosters,
    constructionTime: opts.constructionTime,
    setCodes: opts.setCodes,
    sets: opts.setCodes,
    ...(opts.draftCubeName ? { draftCubeName: opts.draftCubeName } : {}),
    ...(opts.timing ? { timing: opts.timing } : {}),
  }
}

export function buildDraftTournamentArgs(args: {
  name: string
  tournamentType: string
  gameType: string
  deckType: string
  limitedOptions: LimitedDraftOptions
  playerTypes?: string[]
  password?: string
  watchingAllowed?: boolean
  winsNeeded?: number
}): Record<string, unknown> {
  const limited = buildLimitedOptions(args.limitedOptions)
  return {
    name: args.name,
    tournamentType: args.tournamentType,
    gameType: args.gameType,
    matchType: args.gameType,
    deckType: args.deckType,
    limited: true,
    limitedOptions: limited,
    playerTypes: args.playerTypes ?? ['HUMAN'],
    password: args.password ?? '',
    watchingAllowed: args.watchingAllowed ?? true,
    winsNeeded: args.winsNeeded ?? 1,
  }
}

export function parseLimitedSetCodes(raw: string): string[] {
  return raw.split(/[,\s;]+/).map((s) => s.trim().toUpperCase()).filter(Boolean)
}

export function isDraftTournamentType(tournamentType: unknown): boolean {
  if (typeof tournamentType === 'string') return tournamentType.includes('Draft')
  if (tournamentType && typeof tournamentType === 'object' && 'name' in tournamentType && typeof (tournamentType as { name: unknown }).name === 'string') {
    return ((tournamentType as { name: string }).name).includes('Draft')
  }
  return false
}

export const MAX_COMMANDER_PLAYERS = 4
export const MAX_DRAFT_PLAYERS = 8
export const MAX_TOURNAMENT_PLAYERS = 32

export function getEffectiveMaxPlayers(gameType: string, gameTypes: GameTypeInfo[], isDraft: boolean): number {
  if (isDraft) return MAX_DRAFT_PLAYERS
  const info = gameTypes.find((g) => g.name === gameType)
  if (info) return info.maxPlayers
  if (gameType.toLowerCase().includes('commander')) return MAX_COMMANDER_PLAYERS
  return 2
}

export interface SeatConfig {
  type: string
  deckName: string
  skill: number
}

export type WizardStep = { id: CreateTab; icon: import('../../ui/Icon').IconName; labelKey: string; titleFallback: string }

export const WIZARD_STEPS_BASE: WizardStep[] = [
  { id: 'general', icon: 'settings', labelKey: 'create_tab_general', titleFallback: 'General' },
  { id: 'timing', icon: 'clock', labelKey: 'create_tab_timing', titleFallback: 'Tiempos & Reglas' },
  { id: 'security', icon: 'shield', labelKey: 'create_tab_restrictions', titleFallback: 'Restricciones' },
  { id: 'seats', icon: 'bot', labelKey: 'create_tab_multi', titleFallback: 'Jugadores' },
]
