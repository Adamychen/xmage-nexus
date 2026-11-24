import type { GameView } from '../net/types'
import type { TranslationSchema } from '../i18n/types'
import type { PhaseTurn } from './phaseStops'

export type LadderGlyph =
  | 'upkeep'
  | 'draw'
  | 'main1'
  | 'main2'
  | 'beginCombat'
  | 'attackers'
  | 'blockers'
  | 'damage'
  | 'endCombat'
  | 'endStep'
  | 'combat'

export type LadderGroup = 'beginning' | 'main1' | 'combat' | 'main2' | 'end'

export interface LadderStep {
  key: string
  glyph: LadderGlyph
  big: boolean
  group: LadderGroup
  nameKey: keyof TranslationSchema['game']
  stopKey?: string
}

export const LADDER: LadderStep[] = [
  { key: 'UPKEEP', glyph: 'upkeep', big: false, group: 'beginning', nameKey: 'step_upkeep', stopKey: 'upkeep' },
  { key: 'DRAW', glyph: 'draw', big: false, group: 'beginning', nameKey: 'step_draw', stopKey: 'draw' },
  { key: 'PRECOMBAT_MAIN', glyph: 'main1', big: true, group: 'main1', nameKey: 'step_main1', stopKey: 'main1' },
  { key: 'BEGIN_COMBAT', glyph: 'beginCombat', big: false, group: 'combat', nameKey: 'step_begin_combat', stopKey: 'beginCombat' },
  { key: 'DECLARE_ATTACKERS', glyph: 'attackers', big: false, group: 'combat', nameKey: 'step_attackers' },
  { key: 'DECLARE_BLOCKERS', glyph: 'blockers', big: false, group: 'combat', nameKey: 'step_blockers' },
  { key: 'COMBAT_DAMAGE', glyph: 'damage', big: false, group: 'combat', nameKey: 'combat_damage_title' },
  { key: 'END_COMBAT', glyph: 'endCombat', big: false, group: 'combat', nameKey: 'step_end_combat', stopKey: 'endCombat' },
  { key: 'POSTCOMBAT_MAIN', glyph: 'main2', big: true, group: 'main2', nameKey: 'step_main2', stopKey: 'main2' },
  { key: 'END_TURN', glyph: 'endStep', big: false, group: 'end', nameKey: 'step_end_step', stopKey: 'endStep' },
]

export function ladderIndex(step: string | null | undefined): number {
  if (!step) return -1
  const key = step === 'FIRST_COMBAT_DAMAGE' ? 'COMBAT_DAMAGE' : step === 'CLEANUP' ? 'END_TURN' : step
  return LADDER.findIndex((s) => s.key === key)
}

export function shownTurn(game: GameView | null): PhaseTurn | null {
  const me = game?.players?.find((p) => p.controlled)
  if (!game || !me) return null
  return game.activePlayerId === me.playerId ? 'yourTurn' : 'opponentTurn'
}
