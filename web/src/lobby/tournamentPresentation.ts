import { useEffect, useState } from 'react'
import { toBcp47Locale, type SupportedLanguage } from '../i18n'
import type { TournamentView } from '../net/types'
import { currentRoundIndex, eliminationTree, groupRoundMatches, type MatchSummary } from './tournament/matches'
import { parseTournamentTypeText } from './tournament/parse'
import { decomposeTournamentType, eliminationRoundNames, type EliminationRoundName, type Modality, type PackVariant, type Pairing } from './tournament/tournamentType'

type TranslateFn = (ns: 'lobby', key: string, params?: Record<string, string | number>) => string

const ORDINAL_KEYS = {
  one: 'trn_b_ord_one',
  two: 'trn_b_ord_two',
  few: 'trn_b_ord_few',
  other: 'trn_b_ord_other',
} as const

export function ordinalLabel(rank: number, lang: SupportedLanguage, translate: TranslateFn): string {
  const rule = new Intl.PluralRules(toBcp47Locale(lang), { type: 'ordinal' }).select(rank) as keyof typeof ORDINAL_KEYS
  return translate('lobby', ORDINAL_KEYS[rule] ?? ORDINAL_KEYS.other, { n: rank })
}

export const ELIMINATION_ROUND_KEYS = {
  quarterfinal: 'trn_c_round_quarterfinal',
  semifinal: 'trn_c_round_semifinal',
  final: 'trn_c_round_final',
  round_of_16: 'trn_c_round_round_of_16',
  round_of_32: 'trn_c_round_round_of_32',
} as const satisfies Record<EliminationRoundName, string>

export function eliminationRoundOf(view: TournamentView, index: number): EliminationRoundName | null {
  return eliminationRoundNames(eliminationTree(view).columns.length)[index] ?? null
}

export function roundTotal(view: TournamentView): number {
  const total = parseTournamentTypeText(view.tournamentType).totalRounds ?? 0
  return Math.max(view.rounds.length, total)
}

export function matchesByRound(view: TournamentView): MatchSummary[][] {
  return view.rounds.map((round, index) => groupRoundMatches(round, index + 1, view.players))
}

export function currentRoundMatches(view: TournamentView): MatchSummary[] {
  const index = currentRoundIndex(view)
  return index < 0 ? [] : groupRoundMatches(view.rounds[index], index + 1, view.players)
}

export function startLabel(startTime: number, lang: SupportedLanguage, now: number = Date.now()): string {
  const start = new Date(startTime)
  const locale = toBcp47Locale(lang)
  if (start.toDateString() === new Date(now).toDateString()) {
    return start.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  }
  return start.toLocaleString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

/** Milliseconds since the server snapshot in `view` arrived here, so server clocks tick locally. */
export function useSinceArrival(view: TournamentView): number {
  const now = useNow(1000)
  const [arrival, setArrival] = useState(() => ({ view, at: Date.now() }))
  useEffect(() => {
    setArrival({ view, at: Date.now() })
  }, [view])
  return arrival.view === view ? Math.max(0, now - arrival.at) : 0
}

const PAIRING_KEYS: Record<Pairing, string> = { swiss: 'trn_pairing_swiss', elimination: 'trn_pairing_elimination' }

const MODALITY_KEYS: Record<Modality, string> = {
  draft: 'trn_modality_draft',
  sealed: 'trn_modality_sealed',
  jumpstart: 'trn_modality_jumpstart',
  constructed: 'trn_modality_constructed',
}

const VARIANT_KEYS: Record<PackVariant, string> = {
  standard: 'trn_pack_standard',
  cube: 'trn_pack_cube',
  random: 'trn_pack_random',
  reshuffled: 'trn_pack_reshuffled',
  richman: 'trn_pack_richman',
  richmancube: 'trn_pack_richmancube',
  custom: 'trn_pack_custom',
}

/** `Swiss · Constructed · Modern`, `Elimination · Booster Draft · Cube`; the server's text when it does not decompose. */
export function tournamentKicker(view: TournamentView, translate: TranslateFn): string {
  const { type, deckType } = parseTournamentTypeText(view.tournamentType)
  const choice = decomposeTournamentType(type)
  if (!choice) return view.tournamentType
  const parts = [translate('lobby', PAIRING_KEYS[choice.pairing]), translate('lobby', MODALITY_KEYS[choice.modality])]
  if (choice.modality === 'constructed') {
    const deck = deckType?.split(' - ').pop()?.trim()
    if (deck) parts.push(deck)
  } else if (choice.variant !== 'standard') {
    parts.push(translate('lobby', VARIANT_KEYS[choice.variant]))
  }
  return parts.join(' · ')
}

export function isElimination(view: TournamentView): boolean {
  const { type } = parseTournamentTypeText(view.tournamentType)
  const choice = decomposeTournamentType(type)
  return choice ? choice.pairing === 'elimination' : view.tournamentType.includes('Elimination')
}

/** `m:ss` for a count of seconds, minutes unpadded. */
export function clockText(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export function initialOf(name: string): string {
  return Array.from(name.trim())[0]?.toUpperCase() ?? ''
}
