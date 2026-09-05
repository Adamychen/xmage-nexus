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
  'COMPUTER_DRAFT',
]

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

export interface LimitedDraftOptions {
  numberBoosters: number
  constructionTime: number
  setCodes: string[]
  draftCubeName?: string
}

export const LIMITED_BOOSTER_OPTIONS = [3, 6] as const
export const CONSTRUCTION_TIME_OPTIONS = [
  { label: '5 minutos', value: 300 },
  { label: '10 minutos', value: 600 },
  { label: '15 minutos', value: 900 },
  { label: '25 minutos', value: 1500 },
] as const

export function buildLimitedOptions(opts: LimitedDraftOptions): Record<string, unknown> {
  return {
    numberBoosters: opts.numberBoosters,
    constructionTime: opts.constructionTime,
    setCodes: opts.setCodes,
    sets: opts.setCodes,
    ...(opts.draftCubeName ? { draftCubeName: opts.draftCubeName } : {}),
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
  return raw.split(/[,\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean)
}

export const MAX_COMMANDER_PLAYERS = 4
export const MAX_DRAFT_PLAYERS = 8

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
}

export type WizardStep = { id: CreateTab; icon: import('../../ui/Icon').IconName; labelKey: string; titleFallback: string }

export const WIZARD_STEPS_BASE: WizardStep[] = [
  { id: 'general', icon: 'settings', labelKey: 'create_tab_general', titleFallback: 'General' },
  { id: 'timing', icon: 'clock', labelKey: 'create_tab_timing', titleFallback: 'Tiempos & Reglas' },
  { id: 'security', icon: 'shield', labelKey: 'create_tab_restrictions', titleFallback: 'Restricciones' },
  { id: 'seats', icon: 'bot', labelKey: 'create_tab_multi', titleFallback: 'Jugadores' },
]
