import type { CategoryT, TranslationSchema } from '../../i18n/types'
import {
  VARIANTS_BY_MODALITY,
  decomposeTournamentType,
  eliminationRoundCount,
  eliminationRoundNames,
  type EliminationRoundName,
  type Modality,
  type Pairing,
  type PackVariant,
  type TournamentChoice,
} from '../tournament/tournamentType'
import { parseLimitedSetCodes } from './constants'

type LobbyT = CategoryT<'lobby'>
export type LobbyKey = keyof TranslationSchema['lobby']

export const MODALITY_ORDER: Modality[] = ['draft', 'sealed', 'jumpstart', 'constructed']
export const PAIRING_ORDER: Pairing[] = ['swiss', 'elimination']

export const MODALITY_KEY: Record<Modality, LobbyKey> = {
  draft: 'trn_modality_draft',
  sealed: 'trn_modality_sealed',
  jumpstart: 'trn_modality_jumpstart',
  constructed: 'trn_modality_constructed',
}

export const MODALITY_DESC_KEY: Record<Modality, LobbyKey> = {
  draft: 'trn_modality_draft_desc',
  sealed: 'trn_modality_sealed_desc',
  jumpstart: 'trn_modality_jumpstart_desc',
  constructed: 'trn_modality_constructed_desc',
}

export const PAIRING_KEY: Record<Pairing, LobbyKey> = {
  swiss: 'trn_pairing_swiss',
  elimination: 'trn_pairing_elimination',
}

export const PAIRING_DESC_KEY: Record<Pairing, LobbyKey> = {
  swiss: 'trn_pairing_swiss_desc',
  elimination: 'trn_pairing_elimination_desc',
}

export const PACK_KEY: Record<PackVariant, LobbyKey> = {
  standard: 'trn_pack_standard',
  cube: 'trn_pack_cube',
  random: 'trn_pack_random',
  reshuffled: 'trn_pack_reshuffled',
  richman: 'trn_pack_richman',
  richmancube: 'trn_pack_richmancube',
  custom: 'trn_pack_custom',
}

const ROUND_KEY: Record<EliminationRoundName, LobbyKey> = {
  final: 'trn_round_final',
  semifinal: 'trn_round_semifinal',
  quarterfinal: 'trn_round_quarterfinal',
  round_of_16: 'trn_round_of_16',
  round_of_32: 'trn_round_of_32',
}

export const FALLBACK_CHOICE: TournamentChoice = { modality: 'draft', pairing: 'elimination', variant: 'standard' }

/** The choice a server type name stands for; the draft elimination when the name is not a known shape. */
export function choiceOf(serverName: string): TournamentChoice {
  return decomposeTournamentType(serverName) ?? FALLBACK_CHOICE
}

/** A modality with the pack variant kept when the new modality offers it, else its first variant. */
export function choiceWithModality(choice: TournamentChoice, modality: Modality): TournamentChoice {
  const variants = VARIANTS_BY_MODALITY[modality]
  const variant = variants.includes(choice.variant) ? choice.variant : (variants[0] ?? 'standard')
  return { modality, pairing: choice.pairing, variant }
}

/** Set-booster pools: a draft (standard, reshuffled, rich man) or a sealed standard pool. */
export function isSetBased(choice: TournamentChoice): boolean {
  if (choice.modality === 'draft') return choice.variant === 'standard' || choice.variant === 'reshuffled' || choice.variant === 'richman'
  if (choice.modality === 'sealed') return choice.variant === 'standard'
  return false
}

export function isCubeBased(choice: TournamentChoice): boolean {
  return choice.variant === 'cube' || choice.variant === 'richmancube'
}

export function summariseSetCodes(codes: string[]): string {
  const counts = new Map<string, number>()
  for (const code of codes) counts.set(code, (counts.get(code) ?? 0) + 1)
  return [...counts].map(([code, n]) => (n > 1 ? `${code} ×${n}` : code)).join(', ')
}

/** One code per booster; a missing booster has an empty code. */
export function slotCodes(raw: string, boosters: number): string[] {
  const parsed = parseLimitedSetCodes(raw)
  return Array.from({ length: boosters }, (_, i) => parsed[i] ?? '')
}

export function withSlot(raw: string, boosters: number, index: number, code: string): string {
  const parsed = parseLimitedSetCodes(raw)
  const current = Array.from({ length: boosters }, (_, i) => parsed[i] ?? parsed[0] ?? code)
  current[index] = code
  return current.join(', ')
}

export function fillSlots(boosters: number, code: string): string {
  return Array.from({ length: boosters }, () => code).join(', ')
}

export function eliminationRoundLabels(seats: number, t: LobbyT): string {
  return eliminationRoundNames(eliminationRoundCount(seats)).map((name) => t('lobby', ROUND_KEY[name])).join(' → ')
}

function modalityLabel(choice: TournamentChoice, t: LobbyT): string {
  const base = t('lobby', MODALITY_KEY[choice.modality])
  return choice.modality === 'constructed' || choice.variant === 'standard' ? base : `${base} (${t('lobby', PACK_KEY[choice.variant])})`
}

export function clockLabel(timeLimit: string, t: LobbyT): string {
  if (timeLimit === 'NONE') return t('lobby', 'trn_sum_no_clock')
  return t('lobby', 'trn_sum_clock', { min: timeLimit.replace('MIN__', '') })
}

export interface TourneySummaryInput {
  tournamentType: string
  numPlayers: number
  wins: number
  timeLimit: string
}

/** One line per step tab: the format in words, the rules in short, the seat count. */
export function tourneySummaries(input: TourneySummaryInput, t: LobbyT): Record<'format' | 'rules' | 'seats', string> {
  const choice = choiceOf(input.tournamentType)
  const seats = t('lobby', 'staging_seats_count', { count: input.numPlayers })
  return {
    format: t('lobby', 'trn_sum_format', {
      modality: modalityLabel(choice, t),
      pairing: t('lobby', PAIRING_KEY[choice.pairing]),
      seats,
    }),
    rules: t('lobby', 'trn_sum_rules', { bo: `Bo${input.wins * 2 - 1}`, clock: clockLabel(input.timeLimit, t) }),
    seats,
  }
}
