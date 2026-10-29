export type Modality = 'draft' | 'sealed' | 'jumpstart' | 'constructed'

export type Pairing = 'swiss' | 'elimination'

export type PackVariant = 'standard' | 'cube' | 'random' | 'reshuffled' | 'richman' | 'richmancube' | 'custom'

export interface TournamentChoice {
  modality: Modality
  pairing: Pairing
  variant: PackVariant
}

export type EliminationRoundName = 'final' | 'semifinal' | 'quarterfinal' | 'round_of_16' | 'round_of_32'

export const SWISS_ROUNDS_MIN = 2

export const SWISS_ROUNDS_MAX = 10

export const VARIANTS_BY_MODALITY: Record<Modality, PackVariant[]> = {
  draft: ['standard', 'cube', 'random', 'reshuffled', 'richman', 'richmancube'],
  sealed: ['standard', 'cube'],
  jumpstart: ['standard', 'custom'],
  constructed: [],
}

const MODALITY_NAME: Record<Modality, string> = {
  draft: 'Booster Draft',
  sealed: 'Sealed',
  jumpstart: 'Jumpstart',
  constructed: 'Constructed',
}

const PAIRING_NAME: Record<Pairing, string> = {
  swiss: 'Swiss',
  elimination: 'Elimination',
}

const VARIANT_SUFFIX: Record<PackVariant, string> = {
  standard: '',
  cube: ' (Cube)',
  random: ' (Random)',
  reshuffled: ' (Reshuffled)',
  richman: ' (Rich Man)',
  richmancube: ' (Rich Man Cube)',
  custom: ' (Custom)',
}

const FROM_THE_FINAL: EliminationRoundName[] = ['final', 'semifinal', 'quarterfinal', 'round_of_16', 'round_of_32']

export function composeTournamentType(choice: TournamentChoice): string {
  const suffix = choice.modality === 'constructed' ? '' : VARIANT_SUFFIX[choice.variant]
  return `${MODALITY_NAME[choice.modality]} ${PAIRING_NAME[choice.pairing]}${suffix}`
}

/** The inverse of composeTournamentType; null unless composing the result gives back exactly `name`. */
export function decomposeTournamentType(name: string): TournamentChoice | null {
  const modality = (Object.keys(MODALITY_NAME) as Modality[]).find((m) => name.startsWith(`${MODALITY_NAME[m]} `))
  if (!modality) return null
  const rest = name.slice(MODALITY_NAME[modality].length + 1)
  const pairing = (Object.keys(PAIRING_NAME) as Pairing[]).find((p) => rest.startsWith(PAIRING_NAME[p]))
  if (!pairing) return null
  const suffix = rest.slice(PAIRING_NAME[pairing].length)
  const variant = (Object.keys(VARIANT_SUFFIX) as PackVariant[]).find((v) => VARIANT_SUFFIX[v] === suffix)
  if (!variant) return null
  const choice: TournamentChoice = { modality, pairing, variant }
  return composeTournamentType(choice) === name ? choice : null
}

export function isChoiceListed(choice: TournamentChoice, catalogue: readonly string[]): boolean {
  return catalogue.includes(composeTournamentType(choice))
}

export function choiceDisabledReason(choice: TournamentChoice, catalogue: readonly string[]): 'not-listed' | null {
  return isChoiceListed(choice, catalogue) ? null : 'not-listed'
}

export function clampSwissRounds(n: number): number {
  if (!Number.isFinite(n)) return SWISS_ROUNDS_MIN
  return Math.min(SWISS_ROUNDS_MAX, Math.max(SWISS_ROUNDS_MIN, Math.trunc(n)))
}

export function recommendedSwissRounds(seats: number): number {
  return clampSwissRounds(Math.ceil(Math.log2(seats)))
}

export function eliminationRoundCount(seats: number): number {
  const rounds = Math.ceil(Math.log2(seats))
  return Number.isFinite(rounds) ? Math.max(1, rounds) : 1
}

/** Keys in order from the first round to the final; more than five rounds reuse `round_of_32`. */
export function eliminationRoundNames(count: number): EliminationRoundName[] {
  const rounds = Math.max(0, Math.trunc(count))
  return Array.from({ length: rounds }, (_, i) => FROM_THE_FINAL[Math.min(rounds - 1 - i, FROM_THE_FINAL.length - 1)])
}
